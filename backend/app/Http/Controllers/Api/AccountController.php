<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\SettingService;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The signed-in person's own profile, password, two-step sign-in and devices. */
class AccountController extends Controller
{
    public function __construct(private TwoFactorService $twoFactor) {}

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'display_name' => ['nullable', 'string', 'max:60'],
            'user_type' => ['nullable', Rule::in(['local', 'tourist'])],
            'preferred_locale' => ['nullable', Rule::in(['en', 'ms', 'zh'])],
            'bio' => ['nullable', 'string', 'max:500'],
        ]);
        $user = $request->user();

        $user->update(['name' => $data['name']]);
        $user->profile()->update(collect($data)->except('name')->all());

        return response()->json([
            'message' => 'Your profile is saved.',
            'user' => new UserResource($user->fresh(['profile', 'roles'])),
        ]);
    }

    public function updatePassword(Request $request, SettingService $settings): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', 'min:'.$settings->get('security', 'password_min_length', 10)],
        ], [
            'current_password.current_password' => 'Your current password is not right.',
            'password.different' => 'Please choose a password you have not used here before.',
        ]);
        $user = $request->user();

        $user->update(['password' => $data['password']]);
        // stay signed in here, sign out everywhere else
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();
        activity('auth')->performedOn($user)->causedBy($user)->event('password_changed')->log('Changed own password');

        return response()->json(['message' => 'Password changed. Other devices have been signed out.']);
    }

    public function twoFactorBegin(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasTwoFactorEnabled()) {
            throw new FriendlyException('Two-step sign-in is already on.', 'TWO_FACTOR_ALREADY_ON', 409);
        }

        return response()->json($this->twoFactor->begin($user));
    }

    public function twoFactorConfirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $codes = $this->twoFactor->confirm($request->user(), $data['code']);
        activity('auth')->performedOn($request->user())->causedBy($request->user())->event('two_factor_enabled')->log('Turned on two-step sign-in');

        return response()->json([
            'message' => 'Two-step sign-in is on. Save your recovery codes somewhere safe.',
            'recovery_codes' => $codes,
        ]);
    }

    public function twoFactorDisable(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']], [
            'password.current_password' => 'That password is not right.',
        ]);
        $user = $request->user();

        $required = app(SettingService::class)->get('security', 'require_two_factor_roles', []);
        if ($user->hasAnyRole($required)) {
            throw new FriendlyException('Your role requires two-step sign-in, so it cannot be turned off.', 'TWO_FACTOR_REQUIRED_BY_ROLE', 403);
        }

        $this->twoFactor->disable($user);
        activity('auth')->performedOn($user)->causedBy($user)->event('two_factor_disabled')->log('Turned off two-step sign-in');

        return response()->json(['message' => 'Two-step sign-in is off. We recommend turning it back on.']);
    }

    public function recoveryCodes(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']], [
            'password.current_password' => 'That password is not right.',
        ]);

        return response()->json([
            'message' => 'New recovery codes created. The old ones no longer work.',
            'recovery_codes' => $this->twoFactor->regenerateRecoveryCodes($request->user()),
        ]);
    }

    public function sessions(Request $request): JsonResponse
    {
        $current = $request->user()->currentAccessToken()->id;

        $sessions = $request->user()->tokens()
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->latest('last_used_at')
            ->get()
            ->filter(fn ($token) => in_array('*', $token->abilities, true))
            ->map(fn ($token) => [
                'id' => $token->id,
                'device' => $token->name,
                'is_current' => $token->id === $current,
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'created_at' => $token->created_at->toIso8601String(),
                'expires_at' => $token->expires_at?->toIso8601String(),
            ])
            ->values();

        return response()->json(['data' => $sessions]);
    }

    public function revokeSession(Request $request, int $id): JsonResponse
    {
        $deleted = $request->user()->tokens()->where('id', $id)->delete();
        if (! $deleted) {
            throw new FriendlyException('That device is already signed out.', 'NOT_FOUND', 404);
        }

        return response()->json(['message' => 'That device has been signed out.']);
    }

    public function revokeOtherSessions(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['message' => $count ? "Signed out of {$count} other device(s)." : 'No other devices were signed in.']);
    }
}
