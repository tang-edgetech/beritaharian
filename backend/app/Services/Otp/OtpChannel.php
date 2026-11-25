<?php

namespace App\Services\Otp;

use App\Models\User;

/**
 * One way of delivering a one-time code. Email is the only channel at launch;
 * WhatsApp (Meta Cloud API) and SMS are added later as new classes and listed in
 * OtpService::CHANNELS, with no change to the sign-up flow.
 */
interface OtpChannel
{
    public function name(): string;

    /** The address or number this channel sends to for the given user, or null if they have none. */
    public function destinationFor(User $user): ?string;

    public function send(string $destination, string $code, string $purpose): void;
}
