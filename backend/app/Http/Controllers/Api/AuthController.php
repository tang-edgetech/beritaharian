<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\AuthService;
use App\Services\Otp\OtpService;
use App\Services\SettingService;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function __construct(
        private AuthService $auth,
        private OtpService $otp,
        private SettingService $settings,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $request->merge([
            'email' => $request->filled('email') ? mb_strtolower(trim($request->input('email'))) : null,
            'phone' => $this->auth->normalisePhone($request->input('phone')),
        ]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')],
            'password' => ['required', 'string', 'confirmed', 'min:'.$this->settings->get('security', 'password_min_length', 10)],
            'user_type' => ['nullable', Rule::in(['local', 'tourist'])],
            'accept_terms' => ['accepted'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ], [
            'email.unique' => 'This email already has an account. Try signing in instead.',
            'phone.unique' => 'This phone number already has an account.',
            'accept_terms.accepted' => 'Please accept the terms and privacy notice to continue.',
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
            ]);
            $user->profile()->update(['user_type' => $data['user_type'] ?? null]);
            $user->assignRole('member');

            return $user;
        });

        $this->otp->issue($user, OtpCode::PURPOSE_VERIFY_ACCOUNT, 'email');

        return response()->json([
            'status' => 'verification_required',
            'message' => 'Account created. We sent a 6-digit code to your email.',
            'token' => $user->createToken($data['device_name'] ?? 'web', [AuthService::ABILITY_VERIFY], now()->addHour())->plainTextToken,
            'destination' => $this->auth->maskEmail($user->email),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json($this->auth->attempt($request, $data['login'], $data['password'], $data['device_name'] ?? 'web'));
    }

    public function sendVerification(Request $request): JsonResponse
    {
        $data = $request->validate(['channel' => ['nullable', 'string']]);
        $user = $request->user();

        if ($user->isVerified()) {
            return response()->json(['message' => 'Your account is already confirmed.']);
        }

        $this->otp->issue($user, OtpCode::PURPOSE_VERIFY_ACCOUNT, $data['channel'] ?? 'email');

        return response()->json(['message' => 'We sent a new code. It expires in 10 minutes.']);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        $user = $request->user();

        $otp = $this->otp->consume($user, OtpCode::PURPOSE_VERIFY_ACCOUNT, $data['code']);

        $column = $otp->channel === 'email' ? 'email_verified_at' : 'phone_verified_at';
        $user->forceFill([$column => now()])->save();

        $device = $user->currentAccessToken()->name;
        $user->currentAccessToken()->delete();

        $result = $this->auth->complete($request, $user, $device);
        $result['message'] = 'Your account is confirmed. Welcome to '.config('app.name').'!';

        return response()->json($result);
    }

    public function twoFactorChallenge(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'max:10'],
            'recovery_code' => ['required_without:code', 'nullable', 'string', 'max:20'],
        ]);
        $user = $request->user();

        $passed = ! empty($data['code'])
            ? $twoFactor->verify($user, $data['code'])
            : $twoFactor->useRecoveryCode($user, $data['recovery_code']);

        if (! $passed) {
            $this->auth->record($request, $user->email ?? $user->phone, $user, false, 'two_factor_failed');
            throw new FriendlyException('That code is not right. Try the newest code from your app.', 'TWO_FACTOR_INVALID', 422);
        }

        $device = $user->currentAccessToken()->name;
        $user->currentAccessToken()->delete();

        return response()->json($this->auth->complete($request, $user, $device));
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['login' => ['required', 'string', 'max:190']]);
        $user = $this->auth->findByLogin($data['login']);

        if ($user && $user->isActive()) {
            try {
                $this->otp->issue($user, OtpCode::PURPOSE_RESET_PASSWORD, 'email');
            } catch (FriendlyException $e) {
                if ($e->errorCode === 'OTP_TOO_SOON') {
                    throw $e;
                }
            }
        }

        // same answer whether or not the account exists, so this can't be used to check who has an account
        return response()->json(['message' => 'If that account exists, we sent a code to its email.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:190'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'confirmed', 'min:'.$this->settings->get('security', 'password_min_length', 10)],
        ]);

        $user = $this->auth->findByLogin($data['login']);
        if (! $user) {
            throw new FriendlyException('That code has expired. Please ask for a new one.', 'OTP_EXPIRED', 422);
        }

        $this->otp->consume($user, OtpCode::PURPOSE_RESET_PASSWORD, $data['code']);

        $user->forceFill(['password' => $data['password']])->save();
        $user->tokens()->delete();
        activity('auth')->performedOn($user)->causedBy($user)->event('password_reset')->log('Password reset with an emailed code');

        return response()->json(['message' => 'Your password is changed. Please sign in with the new one.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['profile', 'roles']);
        $required = $this->settings->get('security', 'require_two_factor_roles', []);

        return response()->json([
            'user' => (new UserResource($user))->withPermissions(),
            'two_factor_setup_required' => ! $user->hasTwoFactorEnabled() && $user->hasAnyRole($required),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'You are signed out.']);
    }
}
