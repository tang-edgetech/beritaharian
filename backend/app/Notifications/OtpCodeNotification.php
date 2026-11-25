<?php

namespace App\Notifications;

use App\Models\OtpCode;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OtpCodeNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly string $code, public readonly string $purpose) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $app = config('app.name');
        $reason = $this->purpose === OtpCode::PURPOSE_RESET_PASSWORD
            ? 'reset your password'
            : 'confirm your account';

        return (new MailMessage)
            ->subject("Your {$app} code: {$this->code}")
            ->line("Use this code to {$reason}:")
            ->line("**{$this->code}**")
            ->line('It expires in 10 minutes. If you did not ask for it, you can ignore this email.');
    }
}
