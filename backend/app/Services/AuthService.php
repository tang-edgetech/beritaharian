<?php

namespace App\Services;

use App\Exceptions\FriendlyException;
use App\Http\Resources\UserResource;
use App\Models\LoginHistory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Sign-in is a short sequence of steps. Each unfinished step hands out a token that can only
 * do that step (Sanctum abilities):
 *   verify-account  -> may only send/check the account verification code
 *   two-factor      -> may only answer the two-step sign-in challenge
 *   *               -> full access
 */
class AuthService
{
    public const ABILITY_VERIFY = 'account:verify';

    public const ABILITY_TWO_FACTOR = 'auth:two-factor';

    public function __construct(private SettingService $settings) {}

    public function findByLogin(string $login): ?User
    {
        $login = trim($login);

        return str_contains($login, '@')
            ? User::where('email', mb_strtolower($login))->first()
            : User::where('phone', $this->normalisePhone($login))->first();
    }

    /** Malaysian numbers stored as +60XXXXXXXXX. */
    public function normalisePhone(?string $phone): ?string
    {
        if (! $phone) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $phone);
        if (str_starts_with($digits, '0')) {
            $digits = '6'.$digits;
        }

        return '+'.$digits;
    }

    public function attempt(Request $request, string $login, string $password, string $device): array
    {
        $maxAttempts = (int) $this->settings->get('security', 'max_login_attempts', 5);
        $lockMinutes = (int) $this->settings->get('security', 'lockout_minutes', 15);
        $key = 'login:'.mb_strtolower($login).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);
            $this->record($request, $login, null, false, 'locked');
            throw new FriendlyException("Too many sign-in attempts. Please try again in {$minutes} minute(s).", 'LOGIN_LOCKED', 429);
        }

        $user = $this->findByLogin($login);

        if (! $user || ! Hash::check($password, $user->password)) {
            RateLimiter::hit($key, $lockMinutes * 60);
            $this->record($request, $login, $user, false, 'wrong_password');
            throw new FriendlyException("That email or phone and password don't match. Please try again.", 'INVALID_CREDENTIALS', 422);
        }

        if (! $user->isActive()) {
            $this->record($request, $login, $user, false, $user->status);
            throw new FriendlyException('This account is not active. Please contact us if you think this is a mistake.', 'ACCOUNT_INACTIVE', 403);
        }

        RateLimiter::clear($key);

        if (! $user->isVerified()) {
            return [
                'status' => 'verification_required',
                'message' => 'Please confirm your account to continue.',
                'token' => $user->createToken($device, [self::ABILITY_VERIFY], now()->addHour())->plainTextToken,
                'destination' => $this->maskEmail($user->email),
            ];
        }

        if ($user->hasTwoFactorEnabled()) {
            return [
                'status' => 'two_factor_required',
                'message' => 'Enter the code from your authenticator app.',
                'token' => $user->createToken($device, [self::ABILITY_TWO_FACTOR], now()->addMinutes(10))->plainTextToken,
            ];
        }

        return $this->complete($request, $user, $device, $login);
    }

    /** Final step: full-access token. */
    public function complete(Request $request, User $user, string $device, ?string $login = null): array
    {
        $hours = (int) $this->settings->get('security', 'token_lifetime_hours', 12);

        $user->forceFill(['last_login_at' => now(), 'last_login_ip' => $request->ip()])->saveQuietly();
        $this->record($request, $login ?? ($user->email ?? $user->phone), $user, true);

        $required = $this->settings->get('security', 'require_two_factor_roles', []);

        return [
            'status' => 'authenticated',
            'message' => 'Welcome back, '.$user->name.'.',
            'token' => $user->createToken($device, ['*'], now()->addHours($hours))->plainTextToken,
            'two_factor_setup_required' => ! $user->hasTwoFactorEnabled() && $user->hasAnyRole($required),
            'user' => new UserResource($user->load(['profile', 'roles'])),
        ];
    }

    public function record(Request $request, string $identifier, ?User $user, bool $succeeded, ?string $reason = null): void
    {
        LoginHistory::create([
            'user_id' => $user?->id,
            'identifier' => mb_substr($identifier, 0, 255),
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            'succeeded' => $succeeded,
            'reason' => $reason,
        ]);
    }

    public function maskEmail(?string $email): ?string
    {
        if (! $email || ! str_contains($email, '@')) {
            return null;
        }
        [$name, $domain] = explode('@', $email, 2);

        return mb_substr($name, 0, 2).str_repeat('•', max(1, mb_strlen($name) - 2)).'@'.$domain;
    }
}
