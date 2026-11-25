<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\OtpCodeNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Notification::fake();
    }

    private function sentCode(): string
    {
        $code = null;
        Notification::assertSentOnDemand(OtpCodeNotification::class, function (OtpCodeNotification $n) use (&$code) {
            $code = $n->code;

            return true;
        });

        return $code;
    }

    public function test_register_then_verify_with_emailed_code_gives_full_access(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Siti Aminah',
            'email' => 'Siti@Example.com',
            'password' => 'nasi-lemak-2026',
            'password_confirmation' => 'nasi-lemak-2026',
            'user_type' => 'local',
            'accept_terms' => true,
        ])->assertCreated()->assertJsonPath('status', 'verification_required');

        $verifyToken = $register->json('token');

        // a half-finished sign-in cannot reach normal pages
        $this->withToken($verifyToken)->getJson('/api/v1/auth/me')
            ->assertForbidden()->assertJsonPath('code', 'SIGN_IN_INCOMPLETE');

        $this->withToken($verifyToken)->postJson('/api/v1/auth/verification/verify', ['code' => '000000'])
            ->assertStatus(422)->assertJsonPath('code', 'OTP_INVALID');

        $verified = $this->withToken($verifyToken)->postJson('/api/v1/auth/verification/verify', ['code' => $this->sentCode()])
            ->assertOk()->assertJsonPath('status', 'authenticated');

        $this->app['auth']->forgetGuards();
        $this->withToken($verified->json('token'))->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'siti@example.com')
            ->assertJsonPath('user.is_verified', true)
            ->assertJsonPath('user.roles.0.name', 'member');
    }

    public function test_wrong_password_is_friendly_and_locks_after_too_many_tries(): void
    {
        User::factory()->create(['email' => 'ali@example.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['login' => 'ali@example.com', 'password' => 'wrong'])
                ->assertStatus(422)->assertJsonPath('code', 'INVALID_CREDENTIALS');
        }

        $this->postJson('/api/v1/auth/login', ['login' => 'ali@example.com', 'password' => 'password'])
            ->assertStatus(429)->assertJsonPath('code', 'LOGIN_LOCKED');

        $this->assertDatabaseHas('login_histories', ['identifier' => 'ali@example.com', 'reason' => 'locked']);
    }

    public function test_two_factor_set_up_and_sign_in_with_recovery_code(): void
    {
        $user = User::factory()->create(['email' => 'tan@example.com']);
        $full = $this->postJson('/api/v1/auth/login', ['login' => 'tan@example.com', 'password' => 'password'])
            ->assertJsonPath('status', 'authenticated')->json('token');

        $secret = $this->withToken($full)->postJson('/api/v1/account/two-factor')->assertOk()->json('secret');
        $codes = $this->withToken($full)->postJson('/api/v1/account/two-factor/confirm', [
            'code' => app(Google2FA::class)->getCurrentOtp($secret),
        ])->assertOk()->json('recovery_codes');

        $this->assertCount(8, $codes);
        $this->assertTrue($user->fresh()->hasTwoFactorEnabled());

        $this->app['auth']->forgetGuards();
        $challenge = $this->postJson('/api/v1/auth/login', ['login' => 'tan@example.com', 'password' => 'password'])
            ->assertJsonPath('status', 'two_factor_required')->json('token');

        $this->withToken($challenge)->postJson('/api/v1/auth/two-factor/challenge', ['code' => '123456'])
            ->assertStatus(422)->assertJsonPath('code', 'TWO_FACTOR_INVALID');

        $this->withToken($challenge)->postJson('/api/v1/auth/two-factor/challenge', ['recovery_code' => $codes[0]])
            ->assertOk()->assertJsonPath('status', 'authenticated');

        // a recovery code works only once
        $this->assertNotContains($codes[0], $user->fresh()->two_factor_recovery_codes);
    }

    public function test_password_reset_with_emailed_code(): void
    {
        $user = User::factory()->create(['email' => 'mei@example.com']);

        $this->postJson('/api/v1/auth/password/forgot', ['login' => 'nobody@example.com'])->assertOk();
        $this->postJson('/api/v1/auth/password/forgot', ['login' => 'mei@example.com'])->assertOk();

        $this->postJson('/api/v1/auth/password/reset', [
            'login' => 'mei@example.com',
            'code' => $this->sentCode(),
            'password' => 'cendol-sedap-99',
            'password_confirmation' => 'cendol-sedap-99',
        ])->assertOk();

        $this->postJson('/api/v1/auth/login', ['login' => 'mei@example.com', 'password' => 'cendol-sedap-99'])
            ->assertJsonPath('status', 'authenticated');
    }
}
