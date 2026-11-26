<?php

namespace Tests\Feature;

use App\Models\Directory\Business;
use App\Models\Directory\Review;
use App\Models\User;
use App\Services\Directory\OpeningHours;
use Database\Seeders\DirectorySeeder;
use Database\Seeders\NewsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DirectoryTest extends TestCase
{
    use RefreshDatabase;

    private User $moderator;

    private User $reader;

    // Jonker Street-ish
    private const LAT = 2.19530;

    private const LNG = 102.24710;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, NewsSeeder::class, DirectorySeeder::class]);
        $this->moderator = User::factory()->create(['name' => 'Mod Erator']);
        $this->moderator->assignRole('moderator');
        $this->reader = User::factory()->create(['name' => 'Siti Reader']);
        Storage::fake('local');
        Storage::fake('media');
    }

    private function place(array $overrides = []): array
    {
        Sanctum::actingAs($this->moderator, ['*']);

        return $this->postJson('/api/v1/admin/directory/businesses', array_replace_recursive([
            'sector' => 'food-drink',
            'name' => 'Kopitiam Ujian',
            'description' => 'Old-school coffee shop.',
            'details' => ['halal' => true, 'cuisine' => ['Malay', 'Chinese'], 'price_range' => 'RM', 'unknown' => 'dropped'],
            'contacts' => ['phone' => '06-111 2222', 'email' => 'hello@example.com'],
            'locations' => [[
                'address' => '1 Jalan Hang Jebat',
                'area' => 'jonker-street',
                'latitude' => self::LAT,
                'longitude' => self::LNG,
                'hours' => [['day' => 1, 'opens' => '07:00', 'closes' => '15:00'], ['day' => 5, 'opens' => '18:00', 'closes' => '02:00']],
            ]],
        ], $overrides))->assertCreated()->json('data');
    }

    public function test_moderator_adds_a_place_with_checked_details_and_hours(): void
    {
        $data = $this->place();

        $this->assertSame('active', $data['status']);
        $this->assertSame('kopitiam-ujian', $data['slug']);
        $this->assertEquals(['halal' => true, 'cuisine' => ['Malay', 'Chinese'], 'price_range' => 'RM'], $data['details']);
        $this->assertCount(2, $data['locations'][0]['hours']);
        $this->assertTrue($data['locations'][0]['is_primary']);

        // wrong value for a select is refused with a friendly message
        $this->postJson('/api/v1/admin/directory/businesses', [
            'sector' => 'food-drink', 'name' => 'Bad', 'details' => ['price_range' => 'Free'],
            'locations' => [['address' => 'x', 'latitude' => 2.2, 'longitude' => 102.2]],
        ])->assertStatus(422)->assertJsonPath('errors', fn ($e) => isset($e['details.price_range']));

        // a journalist can't touch the directory
        $journalist = User::factory()->create();
        $journalist->assignRole('journalist');
        Sanctum::actingAs($journalist, ['*']);
        $this->getJson('/api/v1/admin/directory/businesses')->assertForbidden();
    }

    public function test_opening_hours_handle_overnight_periods(): void
    {
        $hours = [['day' => 5, 'opens' => '18:00', 'closes' => '02:00']]; // Friday night
        $friday = Carbon::parse('2026-11-27 23:00', 'Asia/Kuala_Lumpur');
        $this->assertTrue(OpeningHours::isOpen($hours, $friday));
        $this->assertTrue(OpeningHours::isOpen($hours, $friday->copy()->addHours(2))); // Saturday 01:00
        $this->assertFalse(OpeningHours::isOpen($hours, $friday->copy()->addHours(4))); // Saturday 03:00
        $this->assertSame('Open until 2:00 am', OpeningHours::status($hours, $friday)['label']);
        $this->assertStringStartsWith('Closed · opens 6:00 pm', OpeningHours::status($hours, Carbon::parse('2026-11-25 10:00'))['label']);
    }

    public function test_public_list_filters_by_sector_details_open_now_and_distance(): void
    {
        $near = $this->place();
        $this->place([
            'name' => 'Far Away Satay', 'details' => ['halal' => false, 'cuisine' => ['Chinese']],
            'locations' => [['address' => 'Jasin', 'area' => 'jasin-town', 'latitude' => 2.3090, 'longitude' => 102.4300, 'hours' => [['day' => 0, 'opens' => '10:00', 'closes' => '11:00']]]],
        ]);
        $this->place(['name' => 'Waiting Stall', 'status' => 'pending']);

        $all = $this->getJson('/api/v1/public/places?sector=food-drink')->assertOk();
        $this->assertSame(2, $all->json('meta.total')); // pending place is hidden

        $halal = $this->getJson('/api/v1/public/places?sector=food-drink&details[halal]=1')->json('data');
        $this->assertSame(['Kopitiam Ujian'], array_column($halal, 'name'));

        $chinese = $this->getJson('/api/v1/public/places?sector=food-drink&details[cuisine]=Chinese')->json('meta.total');
        $this->assertSame(2, $chinese);

        $byDistance = $this->getJson('/api/v1/public/places?lat=2.3080&lng=102.4290')->json('data');
        $this->assertSame('Far Away Satay', $byDistance[0]['name']);
        $this->assertLessThan(200, $byDistance[0]['distance_m']);

        $this->travelTo(Carbon::parse('next monday 09:00', 'Asia/Kuala_Lumpur'));
        $open = $this->getJson('/api/v1/public/places?open_now=1')->json('data');
        $this->assertSame(['Kopitiam Ujian'], array_column($open, 'name'));
        $this->assertSame('Open until 3:00 pm', $open[0]['hours_today']);

        $pins = $this->getJson('/api/v1/public/places/pins?area=melaka-tengah')->json('data');
        $this->assertCount(1, $pins);

        $page = $this->getJson("/api/v1/public/places/{$near['slug']}")->assertOk();
        $this->assertSame('Halal', $page->json('data.details.0.label'));
        $this->getJson('/api/v1/public/places/waiting-stall')->assertNotFound();
    }

    public function test_check_in_review_shows_at_once_and_far_check_in_is_refused(): void
    {
        $place = $this->place();
        Sanctum::actingAs($this->reader, ['*']);
        $review = [
            'rating' => 4, 'body' => 'Kopi was strong and the kaya toast came quickly. Will come back.',
            'visited_on' => today()->toDateString(), 'proof' => 'checkin', 'is_anonymous' => true,
            'sub_ratings' => ['service' => 5, 'value' => 4],
        ];

        $this->postJson("/api/v1/me/places/{$place['slug']}/reviews", $review + ['latitude' => 2.2500, 'longitude' => 102.3000])
            ->assertStatus(422)->assertJsonPath('code', 'TOO_FAR');

        $this->postJson("/api/v1/me/places/{$place['slug']}/reviews", $review + ['latitude' => self::LAT + 0.0005, 'longitude' => self::LNG])
            ->assertCreated()->assertJsonPath('data.status', 'visible')->assertJsonPath('data.is_verified_visit', true);

        $public = $this->getJson("/api/v1/public/places/{$place['slug']}")->json('data');
        $this->assertSame(1, $public['rating_count']);
        $this->assertEquals(4, $public['rating_avg']);
        $this->assertSame('A Cendol Satay reader', $public['reviews'][0]['author_name']);
        $this->assertArrayNotHasKey('latitude', $public['reviews'][0]);

        // only one review per place
        $this->postJson("/api/v1/me/places/{$place['slug']}/reviews", $review + ['latitude' => self::LAT, 'longitude' => self::LNG])
            ->assertStatus(422)->assertJsonPath('code', 'ALREADY_REVIEWED');
    }

    public function test_receipt_review_waits_for_moderator_and_flagged_text_is_held(): void
    {
        $place = $this->place();
        Sanctum::actingAs($this->reader, ['*']);
        $id = $this->post("/api/v1/me/places/{$place['slug']}/reviews", [
            'rating' => 2, 'body' => 'Waited forty minutes for a plate of mee goreng, and it came cold.',
            'visited_on' => today()->subDays(3)->toDateString(), 'proof' => 'receipt',
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');

        $this->assertSame(0, $this->getJson("/api/v1/public/places/{$place['slug']}")->json('data.rating_count'));

        // the reader can't see the queue; the moderator can and sees the receipt
        $this->getJson('/api/v1/admin/directory/reviews')->assertForbidden();
        Sanctum::actingAs($this->moderator, ['*']);
        $this->getJson('/api/v1/admin/directory/reviews?filter[queue]=check')->assertJsonPath('meta.total', 1);
        $this->get("/api/v1/admin/directory/reviews/{$id}/receipt")->assertOk();
        $this->postJson("/api/v1/admin/directory/reviews/{$id}/moderate", ['action' => 'approve'])->assertOk();
        $this->assertSame(1, $this->getJson("/api/v1/public/places/{$place['slug']}")->json('data.rating_count'));
        $this->assertNotNull(Review::where('ulid', $id)->first()->proof->purge_after);

        // a second reader pastes a phone number: held, whatever the proof
        $other = User::factory()->create();
        Sanctum::actingAs($other, ['*']);
        $this->postJson("/api/v1/me/places/{$place['slug']}/reviews", [
            'rating' => 5, 'body' => 'Best kopi in town, WhatsApp me at 012-345 6789 for the secret menu!',
            'visited_on' => today()->toDateString(), 'proof' => 'checkin', 'latitude' => self::LAT, 'longitude' => self::LNG,
        ])->assertCreated()->assertJsonPath('data.status', 'held');
    }

    public function test_claim_then_owner_replies_and_reports_but_cannot_review_or_delete(): void
    {
        $place = $this->place();
        $owner = User::factory()->create(['name' => 'Ah Seng']);

        // a reader writes a visible review first
        Sanctum::actingAs($this->reader, ['*']);
        $reviewId = $this->postJson("/api/v1/me/places/{$place['slug']}/reviews", [
            'rating' => 3, 'body' => 'Decent coffee but the tables were sticky and nobody wiped them.',
            'visited_on' => today()->toDateString(), 'proof' => 'checkin', 'latitude' => self::LAT, 'longitude' => self::LNG,
        ])->json('data.id');

        Sanctum::actingAs($owner, ['*']);
        // opening place pages must not use up the 5-a-minute claim allowance
        foreach (range(1, 6) as $i) {
            $this->getJson("/api/v1/me/places/{$place['slug']}")->assertOk();
        }
        $this->post("/api/v1/me/places/{$place['slug']}/claims", [
            'role' => 'owner', 'phone' => '012-000 0000', 'document' => UploadedFile::fake()->create('ssm.pdf', 100, 'application/pdf'), 'confirm' => '1',
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->postJson("/api/v1/me/places/{$place['slug']}/claims", ['role' => 'owner', 'phone' => '1', 'ssm_number' => '1', 'confirm' => true])
            ->assertJsonPath('code', 'CLAIM_PENDING');

        Sanctum::actingAs($this->moderator, ['*']);
        $claim = $this->getJson('/api/v1/admin/directory/claims?filter[status]=pending')->json('data.0');
        $this->assertTrue($claim['has_document']);
        $this->postJson("/api/v1/admin/directory/claims/{$claim['id']}/decide", ['action' => 'approve'])->assertOk();
        $this->assertTrue($owner->fresh()->hasRole('business-owner'));

        Sanctum::actingAs($owner, ['*']);
        $this->getJson('/api/v1/me/businesses')->assertJsonPath('data.places.0.slug', $place['slug']);
        $this->putJson("/api/v1/me/reviews/{$reviewId}/reply", ['body' => 'Thanks, we have added a cleaner for the lunch rush.'])->assertOk();
        $this->postJson("/api/v1/me/reviews/{$reviewId}/report", ['reason' => 'fake'])->assertOk();
        $this->deleteJson("/api/v1/me/reviews/{$reviewId}")->assertForbidden();
        $this->postJson("/api/v1/me/places/{$place['slug']}/reviews", [
            'rating' => 5, 'body' => 'My own shop is the best in Melaka, everyone should come.', 'visited_on' => today()->toDateString(),
            'proof' => 'checkin', 'latitude' => self::LAT, 'longitude' => self::LNG,
        ])->assertJsonPath('code', 'OWN_BUSINESS');

        // owner edits hours and description, but the name stays
        $location = $this->getJson("/api/v1/me/businesses/{$place['id']}")->json('data.locations.0.id');
        $this->putJson("/api/v1/me/businesses/{$place['id']}", [
            'description' => 'Since 1962.', 'name' => 'Hijacked',
            'details' => ['halal' => true], 'contacts' => ['whatsapp' => '60120000000'],
            'locations' => [['id' => $location, 'hours' => [['day' => 0, 'opens' => '00:00', 'closes' => '24:00']]]],
        ])->assertOk();
        $public = $this->getJson("/api/v1/public/places/{$place['slug']}")->json('data');
        $this->assertSame('Kopitiam Ujian', $public['name']);
        $this->assertSame('Since 1962.', $public['description']);
        $this->assertSame('Thanks, we have added a cleaner for the lunch rush.', $public['reviews'][0]['reply']['body']);

        // the report reaches the moderators' queue
        Sanctum::actingAs($this->moderator, ['*']);
        $this->getJson('/api/v1/admin/directory/reviews?filter[queue]=reported')->assertJsonPath('meta.total', 1);
        $this->postJson("/api/v1/admin/directory/reviews/{$reviewId}/moderate", ['action' => 'dismiss_reports'])->assertOk();
        $this->getJson('/api/v1/admin/directory/reviews?filter[queue]=reported')->assertJsonPath('meta.total', 0);
    }

    public function test_reader_suggests_a_place_which_waits_for_approval(): void
    {
        Sanctum::actingAs($this->reader, ['*']);
        $this->postJson('/api/v1/me/places', [
            'sector' => 'shops', 'name' => 'Kedai Runcit Baru', 'address' => 'Jalan Klebang', 'area' => 'klebang',
            'latitude' => 2.2160, 'longitude' => 102.1980, 'is_owner' => true,
        ])->assertCreated();
        $this->postJson('/api/v1/me/places', [
            'sector' => 'shops', 'name' => 'Somewhere in KL', 'address' => 'KLCC', 'latitude' => 3.1579, 'longitude' => 101.7116,
        ])->assertStatus(422);

        $this->getJson('/api/v1/public/places/kedai-runcit-baru')->assertNotFound();

        Sanctum::actingAs($this->moderator, ['*']);
        $pending = $this->getJson('/api/v1/admin/directory/businesses?filter[status]=pending')->json('data.0');
        $this->postJson("/api/v1/admin/directory/businesses/{$pending['id']}/status", ['action' => 'approve'])->assertOk();
        $this->getJson('/api/v1/public/places/kedai-runcit-baru')->assertOk()->assertJsonPath('data.is_claimed', true);
        $this->assertTrue($this->reader->fresh()->hasRole('business-owner'));
        $this->assertSame(1, Business::active()->count());
    }

    public function test_sector_detail_fields_are_checked(): void
    {
        Sanctum::actingAs($this->moderator, ['*']);
        $this->postJson('/api/v1/admin/directory/sectors', [
            'name' => 'Petrol stations', 'color' => 'satay',
            'fields' => [['label' => 'Brand', 'type' => 'select', 'options' => ['Petronas']]],
        ])->assertStatus(422);

        $sector = $this->postJson('/api/v1/admin/directory/sectors', [
            'name' => 'Petrol stations', 'color' => 'satay',
            'fields' => [['label' => 'Brand', 'type' => 'select', 'options' => ['Petronas', 'Shell', 'Petron'], 'filterable' => true], ['label' => '24 hours', 'type' => 'boolean']],
        ])->assertCreated()->json('data');
        $this->assertSame(['brand', '24_hours'], array_column($sector['fields'], 'key'));

        $this->place();
        $this->deleteJson('/api/v1/admin/directory/sectors/food-drink')->assertStatus(422)->assertJsonPath('code', 'SECTOR_IN_USE');
        $this->deleteJson('/api/v1/admin/directory/sectors/health')->assertOk();
    }
}
