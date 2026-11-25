<?php

namespace App\Services\Otp;

use App\Models\User;
use App\Notifications\OtpCodeNotification;
use Illuminate\Support\Facades\Notification;

class EmailOtpChannel implements OtpChannel
{
    public function name(): string
    {
        return 'email';
    }

    public function destinationFor(User $user): ?string
    {
        return $user->email;
    }

    public function send(string $destination, string $code, string $purpose): void
    {
        Notification::route('mail', $destination)->notify(new OtpCodeNotification($code, $purpose));
    }
}
