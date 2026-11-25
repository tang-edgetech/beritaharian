<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private User $boss;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->boss = User::factory()->create(['name' => 'Boss', 'email' => 'boss@example.com']);
        $this->boss->assignRole('super-admin');
        $this->boss->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();
    }

    public function test_admin_role_without_two_factor_is_asked_to_set_it_up(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin, ['*']);

        $this->getJson('/api/v1/admin/users')->assertForbidden()->assertJsonPath('code', 'TWO_FACTOR_SETUP_REQUIRED');
    }

    public function test_members_cannot_open_the_admin(): void
    {
        $member = User::factory()->create();
        $member->assignRole('member');
        Sanctum::actingAs($member, ['*']);

        $this->getJson('/api/v1/admin/users')->assertForbidden()->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_user_listing_searches_sorts_and_paginates(): void
    {
        User::factory()->count(30)->create();
        User::factory()->create(['name' => 'Zzz Melaka', 'status' => 'suspended']);
        Sanctum::actingAs($this->boss, ['*']);

        $this->getJson('/api/v1/admin/users?per_page=10')
            ->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.total', 32);

        $this->getJson('/api/v1/admin/users?filter[q]=zzz&filter[status]=suspended')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Zzz Melaka');

        $this->getJson('/api/v1/admin/users?sort=-name&per_page=10')
            ->assertOk()->assertJsonPath('data.0.name', 'Zzz Melaka');

        $this->getJson('/api/v1/admin/users?filter[role]=super-admin')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_bulk_suspend_skips_your_own_account(): void
    {
        $others = User::factory()->count(3)->create();
        Sanctum::actingAs($this->boss, ['*']);

        $this->postJson('/api/v1/admin/users/bulk', [
            'action' => 'suspend',
            'ids' => [...$others->pluck('ulid'), $this->boss->ulid],
        ])->assertOk()->assertJsonPath('affected', 3)->assertJsonPath('skipped', 1);

        $this->assertSame('active', $this->boss->fresh()->status);
        $this->assertSame(3, User::where('status', 'suspended')->count());
    }

    public function test_cannot_delete_yourself_and_deleted_users_can_be_restored(): void
    {
        $ali = User::factory()->create(['name' => 'Ali']);
        Sanctum::actingAs($this->boss, ['*']);

        $this->deleteJson("/api/v1/admin/users/{$this->boss->ulid}")->assertStatus(422)->assertJsonPath('code', 'CANNOT_CHANGE_SELF');

        $this->deleteJson("/api/v1/admin/users/{$ali->ulid}")->assertOk();
        $this->assertSoftDeleted($ali);

        $this->getJson('/api/v1/admin/users?filter[trashed]=only')->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/admin/users/{$ali->ulid}/restore")->assertOk();
        $this->assertNotSoftDeleted($ali);
    }

    public function test_create_user_with_roles_is_audited(): void
    {
        Sanctum::actingAs($this->boss, ['*']);

        $id = $this->postJson('/api/v1/admin/users', [
            'name' => 'Kumar',
            'email' => 'kumar@example.com',
            'phone' => '012-345 6789',
            'password' => 'satay-kajang-1',
            'status' => 'active',
            'roles' => ['editor', 'journalist'],
            'mark_verified' => true,
        ])->assertCreated()->assertJsonPath('data.phone', '+60123456789')->json('data.id');

        $this->assertTrue(User::where('ulid', $id)->first()->hasAllRoles(['editor', 'journalist']));
        $this->getJson('/api/v1/admin/audit-logs?filter[log_name]=users')->assertOk()->assertJsonPath('data.0.area', 'users');
    }

    public function test_roles_can_be_created_edited_and_protected(): void
    {
        Sanctum::actingAs($this->boss, ['*']);

        $this->postJson('/api/v1/admin/roles', [
            'label' => 'Night Desk',
            'description' => 'Covers breaking news after 10pm',
            'permissions' => ['admin.access', 'users.view'],
        ])->assertCreated()->assertJsonPath('data.name', 'night-desk');

        $this->putJson('/api/v1/admin/roles/night-desk', ['label' => 'Night Desk', 'permissions' => ['admin.access']])
            ->assertOk()->assertJsonPath('data.permissions', ['admin.access']);

        $this->deleteJson('/api/v1/admin/roles/member')->assertStatus(422)->assertJsonPath('code', 'ROLE_LOCKED');
        $this->putJson('/api/v1/admin/roles/super-admin', ['label' => 'x'])->assertStatus(422)->assertJsonPath('code', 'ROLE_LOCKED');

        $this->getJson('/api/v1/admin/permissions')->assertOk()->assertJsonFragment(['group' => 'users']);
    }

    /** Uses a real bearer token (not Sanctum::actingAs), the way the admin panel calls the API. */
    public function test_role_list_and_member_counts_work_with_a_real_token(): void
    {
        User::factory()->count(2)->create()->each->assignRole('editor');
        $token = $this->boss->createToken('test', ['*'])->plainTextToken;

        $roles = $this->withToken($token)->getJson('/api/v1/admin/roles')->assertOk()->json('data');
        $editor = collect($roles)->firstWhere("name", "editor");
        $this->assertSame(2, $editor['users_count']);

        $this->withToken($token)->deleteJson('/api/v1/admin/roles/member')
            ->assertStatus(422)->assertJsonPath('code', 'ROLE_LOCKED');
        $this->withToken($token)->deleteJson('/api/v1/admin/roles/editor')
            ->assertStatus(422)->assertJsonPath('code', 'ROLE_IN_USE');

        $this->withToken($token)->postJson('/api/v1/admin/roles', ['label' => 'Desk', 'permissions' => []])->assertCreated();
        User::factory()->create()->assignRole('desk');
        $this->withToken($token)->deleteJson('/api/v1/admin/roles/desk')
            ->assertStatus(422)->assertJsonPath('code', 'ROLE_IN_USE');
    }

    public function test_settings_save_log_changes_and_only_public_values_are_public(): void
    {
        Sanctum::actingAs($this->boss, ['*']);

        $this->putJson('/api/v1/admin/settings/general', [
            'site_name' => 'Cendol Satay',
            'tagline' => 'Apa cerita Melaka?',
            'default_locale' => 'en',
            'enabled_locales' => ['en'],
            'timezone' => 'Asia/Kuala_Lumpur',
            'maintenance_mode' => false,
        ])->assertOk()->assertJsonPath('data.tagline', 'Apa cerita Melaka?');

        $this->getJson('/api/v1/admin/audit-logs?filter[log_name]=settings')
            ->assertOk()->assertJsonPath('data.0.new.tagline', 'Apa cerita Melaka?');

        $public = $this->getJson('/api/v1/settings/public')->assertOk();
        $public->assertJsonPath('data.general.tagline', 'Apa cerita Melaka?');
        $this->assertArrayNotHasKey('max_login_attempts', $public->json('data.security'));
    }
}
