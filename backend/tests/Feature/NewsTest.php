<?php

namespace Tests\Feature;

use App\Models\News\Article;
use App\Models\User;
use Database\Seeders\NewsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NewsTest extends TestCase
{
    use RefreshDatabase;

    private User $journalist;

    private User $verifier;

    private User $editor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, NewsSeeder::class]);
        $this->journalist = $this->staff('journalist', 'Aisyah Writer');
        $this->verifier = $this->staff('verifier', 'Ravi Checker');
        $this->editor = $this->staff('editor', 'Mei Ling Editor');
    }

    private function staff(string $role, string $name): User
    {
        $user = User::factory()->create(['name' => $name]);
        $user->assignRole($role);

        return $user;
    }

    private function body(int $words = 40): array
    {
        return ['type' => 'doc', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => trim(str_repeat('banjir kilat di Bandar Hilir ', (int) ceil($words / 5)))]]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'JKR says', 'marks' => [['type' => 'bold'], ['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]]]],
            ['type' => 'script', 'content' => [['type' => 'text', 'text' => 'bad']]],
        ]];
    }

    private function draft(array $overrides = []): array
    {
        Sanctum::actingAs($this->journalist, ['*']);

        return $this->postJson('/api/v1/admin/news/articles', array_merge([
            'title' => 'Flash flood closes Jalan Parameswara',
            'excerpt' => 'Water rose quickly after the afternoon storm.',
            'body' => $this->body(),
            'category' => 'traffic',
            'area' => 'bandar-hilir',
            'tags' => ['banjir', 'Jalan Parameswara', 'banjir'],
            'sources' => [['kind' => 'official', 'label' => 'JKR Melaka statement', 'url' => 'https://example.com/jkr']],
        ], $overrides))->assertCreated()->json('data');
    }

    public function test_body_is_cleaned_and_draft_is_saved_with_tags_and_sources(): void
    {
        $draft = $this->draft();

        $this->assertSame('draft', $draft['status']);
        $this->assertSame('flash-flood-closes-jalan-parameswara', $draft['slug']);
        $this->assertEqualsCanonicalizing(['banjir', 'Jalan Parameswara'], $draft['tags']); // duplicates merged
        $this->assertCount(2, $draft['body']['content']); // the unknown "script" node is dropped
        $this->assertSame([['type' => 'bold']], $draft['body']['content'][1]['content'][0]['marks']); // unsafe link removed
        $this->assertContains('submit', $draft['actions']);
        $this->assertNotContains('publish', $draft['actions']);
    }

    public function test_full_workflow_from_draft_to_public_page(): void
    {
        $id = $this->draft()['id'];
        $url = "/api/v1/admin/news/articles/{$id}/workflow";

        $this->postJson($url, ['action' => 'submit'])->assertOk()->assertJsonPath('data.status', 'in_review');

        // the journalist can't change it while it is being checked
        $this->putJson("/api/v1/admin/news/articles/{$id}", ['title' => 'Sneaky edit'])->assertForbidden();

        Sanctum::actingAs($this->editor, ['*']);
        $this->postJson($url, ['action' => 'publish'])->assertForbidden(); // not verified yet

        Sanctum::actingAs($this->verifier, ['*']);
        $this->postJson($url, ['action' => 'verify'])->assertOk()->assertJsonPath('data.status', 'verified')->assertJsonPath('data.truth_label', 'verified');

        $this->getJson('/api/v1/public/articles/flash-flood-closes-jalan-parameswara')->assertNotFound();

        Sanctum::actingAs($this->editor, ['*']);
        $this->postJson($url, ['action' => 'publish'])->assertOk()->assertJsonPath('data.status', 'published');

        $public = $this->getJson('/api/v1/public/articles/flash-flood-closes-jalan-parameswara')->assertOk();
        $public->assertJsonPath('data.author.name', 'Aisyah Writer')
            ->assertJsonPath('data.category.slug', 'traffic')
            ->assertJsonPath('data.sources.0.kind', 'Official statement')
            ->assertJsonMissingPath('data.review_note');

        $this->getJson('/api/v1/public/home')->assertOk()->assertJsonPath('data.lead.slug', 'flash-flood-closes-jalan-parameswara');
        $this->getJson('/api/v1/public/articles?area=melaka-tengah')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/public/articles?q=Parameswara')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/public/articles?category=food')->assertOk()->assertJsonCount(0, 'data');

        // editing a live story needs a note; a correction is shown publicly
        $this->putJson("/api/v1/admin/news/articles/{$id}", ['title' => 'Flash flood closes Jalan Parameswara', 'body' => $this->body(), 'category' => 'traffic'])
            ->assertStatus(422);
        $this->putJson("/api/v1/admin/news/articles/{$id}", [
            'title' => 'Flash flood closes Jalan Parameswara for three hours', 'body' => $this->body(), 'category' => 'traffic',
            'change_note' => 'The road was closed for three hours, not one.', 'is_correction' => true,
        ])->assertOk()->assertJsonPath('data.slug', 'flash-flood-closes-jalan-parameswara')->assertJsonPath('data.truth_label', 'corrected');

        $this->getJson('/api/v1/public/articles/flash-flood-closes-jalan-parameswara')
            ->assertJsonPath('data.corrections.0.note', 'The road was closed for three hours, not one.');
    }

    public function test_verifier_cannot_verify_own_story_and_send_back_needs_a_note(): void
    {
        $verifierWriter = $this->staff('verifier', 'Both Roles');
        $verifierWriter->givePermissionTo('news.write');
        Sanctum::actingAs($verifierWriter, ['*']);
        $id = $this->postJson('/api/v1/admin/news/articles', ['title' => 'Own story', 'body' => $this->body(), 'category' => 'local'])->json('data.id');
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'submit'])->assertOk();
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'verify'])
            ->assertForbidden()->assertJsonPath('message', 'You wrote this story, so someone else needs to verify it.');

        Sanctum::actingAs($this->verifier, ['*']);
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'send_back'])->assertStatus(422);
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'send_back', 'note' => 'Add the police statement.'])
            ->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.review_note', 'Add the police statement.');
    }

    public function test_breaking_news_publishes_as_developing_then_gets_verified(): void
    {
        $id = $this->draft(['title' => 'Fire at Jonker Street shophouse'])['id'];
        Sanctum::actingAs($this->editor, ['*']);
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'publish_breaking'])
            ->assertOk()->assertJsonPath('data.truth_label', 'developing')->assertJsonPath('data.is_breaking', true);

        $this->getJson('/api/v1/public/home')->assertJsonPath('data.breaking.0.slug', 'fire-at-jonker-street-shophouse');

        Sanctum::actingAs($this->verifier, ['*']);
        $this->getJson('/api/v1/admin/news/articles?filter[queue]=review')->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'verify'])
            ->assertOk()->assertJsonPath('data.status', 'published')->assertJsonPath('data.truth_label', 'verified');
    }

    public function test_scheduled_story_stays_hidden_until_its_time(): void
    {
        $id = $this->draft(['title' => 'Night market moves to Saturday'])['id'];
        Sanctum::actingAs($this->editor, ['*']);
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'publish_breaking'])->assertOk();
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'archive', 'note' => 'Wrong date'])->assertOk();
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'restore'])->assertOk()->assertJsonPath('data.status', 'draft');

        Article::where('ulid', $id)->update(['status' => 'verified']);
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'publish', 'publish_at' => now()->addHour()->toIso8601String()])
            ->assertOk()->assertJsonPath('data.status', 'scheduled');
        $this->getJson('/api/v1/public/articles/night-market-moves-to-saturday')->assertNotFound();

        $this->travel(2)->hours();
        $this->getJson('/api/v1/public/articles/night-market-moves-to-saturday')->assertOk();
    }

    public function test_journalists_only_see_their_own_stories_and_incomplete_stories_cannot_be_submitted(): void
    {
        $this->draft();
        $other = $this->staff('journalist', 'Other Writer');
        Sanctum::actingAs($other, ['*']);
        $this->getJson('/api/v1/admin/news/articles')->assertOk()->assertJsonCount(0, 'data');

        $id = $this->postJson('/api/v1/admin/news/articles', ['title' => 'Short'])->json('data.id');
        $this->postJson("/api/v1/admin/news/articles/{$id}/workflow", ['action' => 'submit'])
            ->assertStatus(422)->assertJsonPath('code', 'ARTICLE_INCOMPLETE');

        Sanctum::actingAs($this->editor, ['*']);
        $this->getJson('/api/v1/admin/news/articles')->assertJsonCount(2, 'data');
    }

    public function test_cover_upload_makes_resized_copies_and_views_are_counted(): void
    {
        Storage::fake('media');
        Sanctum::actingAs($this->journalist, ['*']);
        $media = $this->post('/api/v1/admin/news/media', ['image' => UploadedFile::fake()->image('river.jpg', 2000, 1200), 'collection' => 'cover'], ['Accept' => 'application/json'])
            ->assertCreated()->json('data');
        $this->assertSame(2000, $media['width']);
        $this->assertStringEndsWith('card.webp', $media['card']);

        $id = $this->draft(['cover' => $media['id'], 'cover_alt' => 'Melaka River at dusk'])['id'];
        $this->getJson("/api/v1/admin/news/articles/{$id}")->assertJsonPath('data.cover.alt', 'Melaka River at dusk');

        Article::where('ulid', $id)->update(['status' => 'published', 'published_at' => now()->subMinute()]);
        $this->postJson('/api/v1/public/articles/flash-flood-closes-jalan-parameswara/view')->assertOk();
        $this->postJson('/api/v1/public/articles/flash-flood-closes-jalan-parameswara/view')->assertOk();
        $this->assertSame(2, Article::where('ulid', $id)->value('view_count'));
    }

    public function test_categories_can_be_reordered_and_in_use_ones_cannot_be_deleted(): void
    {
        $this->draft();
        Sanctum::actingAs($this->editor, ['*']);
        $this->postJson('/api/v1/admin/news/categories', ['name' => 'Heritage', 'color' => 'gula'])->assertCreated()->assertJsonPath('data.slug', 'heritage');
        $this->putJson('/api/v1/admin/news/categories/order', ['slugs' => ['heritage', 'local', 'traffic']])->assertOk();
        $this->getJson('/api/v1/public/categories')->assertJsonPath('data.0.slug', 'heritage');
        $this->deleteJson('/api/v1/admin/news/categories/traffic')->assertStatus(422)->assertJsonPath('code', 'CATEGORY_IN_USE');

        Sanctum::actingAs($this->journalist, ['*']);
        $this->postJson('/api/v1/admin/news/categories', ['name' => 'Nope', 'color' => 'gula'])->assertForbidden();
    }
}
