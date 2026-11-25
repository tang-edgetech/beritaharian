<?php

namespace App\Services;

use App\Exceptions\FriendlyException;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorService
{
    public function __construct(private Google2FA $google2fa) {}

    /** Starts set-up: stores a new secret (not active until confirmed) and returns what the app needs to show. */
    public function begin(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey(32);
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ])->save();

        $label = $user->email ?? $user->phone ?? $user->name;
        $url = $this->google2fa->getQRCodeUrl(config('app.name'), $label, $secret);
        $svg = (new Writer(new ImageRenderer(new RendererStyle(220, 1), new SvgImageBackEnd)))->writeString($url);

        return ['secret' => $secret, 'qr_svg' => $svg, 'otpauth_url' => $url];
    }

    /** @return string[] recovery codes, shown once */
    public function confirm(User $user, string $code): array
    {
        if (! $user->two_factor_secret || ! $this->verify($user, $code)) {
            throw new FriendlyException('That code is not right. Check the time on your phone and try the newest code.', 'TWO_FACTOR_INVALID', 422);
        }

        $codes = $this->newRecoveryCodes();
        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $codes,
        ])->save();

        return $codes;
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ])->save();
    }

    /** Checks an authenticator code. Each code can be used only once. */
    public function verify(User $user, string $code): bool
    {
        $code = preg_replace('/\s+/', '', $code);
        $usedKey = "2fa-used:{$user->id}:{$code}";

        if (Cache::has($usedKey) || ! $this->google2fa->verifyKey($user->two_factor_secret, $code, 1)) {
            return false;
        }

        Cache::put($usedKey, true, now()->addMinutes(2));

        return true;
    }

    /** Uses up one recovery code if it matches. */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $codes = $user->two_factor_recovery_codes ?? [];
        $code = strtoupper(trim($code));

        if (! in_array($code, $codes, true)) {
            return false;
        }

        $user->forceFill(['two_factor_recovery_codes' => array_values(array_diff($codes, [$code]))])->save();

        return true;
    }

    public function regenerateRecoveryCodes(User $user): array
    {
        $codes = $this->newRecoveryCodes();
        $user->forceFill(['two_factor_recovery_codes' => $codes])->save();

        return $codes;
    }

    private function newRecoveryCodes(): array
    {
        return collect(range(1, 8))
            ->map(fn () => strtoupper(Str::random(5).'-'.Str::random(5)))
            ->all();
    }
}
