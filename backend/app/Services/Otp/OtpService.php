<?php

namespace App\Services\Otp;

use App\Exceptions\FriendlyException;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\SettingService;
use Illuminate\Support\Facades\Hash;

class OtpService
{
    public const EXPIRES_MINUTES = 10;

    public const MAX_ATTEMPTS = 5;

    public const RESEND_SECONDS = 60;

    /** @var array<string, class-string<OtpChannel>> */
    public const CHANNELS = [
        'email' => EmailOtpChannel::class,
    ];

    public function __construct(private SettingService $settings) {}

    public function enabledChannels(): array
    {
        return array_values(array_intersect(
            $this->settings->get('security', 'otp_channels', ['email']),
            array_keys(self::CHANNELS),
        ));
    }

    public function channel(string $name): OtpChannel
    {
        if (! in_array($name, $this->enabledChannels(), true)) {
            throw new FriendlyException('That way of receiving codes is not available yet. Please use email.', 'OTP_CHANNEL_UNAVAILABLE', 422);
        }

        return app(self::CHANNELS[$name]);
    }

    public function issue(User $user, string $purpose, string $channelName = 'email'): OtpCode
    {
        $channel = $this->channel($channelName);
        $destination = $channel->destinationFor($user);

        if (! $destination) {
            throw new FriendlyException('There is no address on your account for that option.', 'OTP_NO_DESTINATION', 422);
        }

        $latest = $user->otpCodes()->where('purpose', $purpose)->latest('id')->first();
        if ($latest && $latest->created_at->gt(now()->subSeconds(self::RESEND_SECONDS))) {
            $wait = self::RESEND_SECONDS - $latest->created_at->diffInSeconds(now());
            throw new FriendlyException("Please wait {$wait} seconds before asking for another code.", 'OTP_TOO_SOON', 429);
        }

        // only the newest code for a purpose is valid
        $user->otpCodes()->where('purpose', $purpose)->whereNull('consumed_at')->update(['consumed_at' => now()]);

        $code = (string) random_int(100000, 999999);
        $otp = $user->otpCodes()->create([
            'channel' => $channel->name(),
            'destination' => $destination,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::EXPIRES_MINUTES),
        ]);

        $channel->send($destination, $code, $purpose);

        return $otp;
    }

    /** Checks the code and marks it used. Throws a friendly error when it is wrong or expired. */
    public function consume(User $user, string $purpose, string $code): OtpCode
    {
        $otp = $user->otpCodes()
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $otp || $otp->expires_at->isPast()) {
            throw new FriendlyException('That code has expired. Please ask for a new one.', 'OTP_EXPIRED', 422);
        }

        if ($otp->attempts >= self::MAX_ATTEMPTS) {
            throw new FriendlyException('Too many wrong tries. Please ask for a new code.', 'OTP_LOCKED', 429);
        }

        if (! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');
            $left = self::MAX_ATTEMPTS - $otp->attempts;
            throw new FriendlyException(
                $left > 0 ? "That code is not right. You have {$left} tries left." : 'Too many wrong tries. Please ask for a new code.',
                'OTP_INVALID',
                422,
            );
        }

        $otp->update(['consumed_at' => now()]);

        return $otp;
    }
}
