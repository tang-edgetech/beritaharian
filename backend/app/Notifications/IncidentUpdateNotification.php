<?php

namespace App\Notifications;

use App\Models\Civic\Incident;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Tells a reporter that their report moved on: a question from the team, a decision, or the alert going up. */
class IncidentUpdateNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly Incident $incident, public readonly string $headline, public readonly ?string $body = null) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $ref = $this->incident->reference_no;
        $mail = (new MailMessage)
            ->subject("Your report {$ref}: {$this->headline}")
            ->greeting('Hello '.($notifiable->name ?? '').',')
            ->line("{$this->headline}.")
            ->line("Report: {$ref} · {$this->incident->title}");
        if ($this->body) {
            $mail->line('Message from the Cendol Satay team:')->line($this->body);
        }

        return $mail
            ->action('Open your report', rtrim((string) config('services.web.url'), '/')."/account/reports/{$ref}")
            ->line('Thank you for helping keep Melaka safe.');
    }
}
