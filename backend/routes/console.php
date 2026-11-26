<?php

use App\Models\News\Article;
use App\Models\OtpCode;
use Illuminate\Support\Facades\Schedule;

// cPanel cron, every minute:  php /home/USER/backend/artisan schedule:run >> /dev/null 2>&1
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::call(fn () => OtpCode::where('created_at', '<', now()->subDays(2))->delete())->daily()->name('prune-otp-codes');
Schedule::command('queue:work --stop-when-empty --max-time=55')->everyMinute()->withoutOverlapping();

// Scheduled stories already show on the site once their time comes; this only tidies their status for the admin lists.
Schedule::call(fn () => Article::where('status', Article::SCHEDULED)->where('published_at', '<=', now())->update(['status' => Article::PUBLISHED]))
    ->everyMinute()->name('publish-scheduled-articles');

// Receipt photos from reviews are deleted 90 days after a moderator checked them.
Schedule::call(fn () => app(\App\Services\Directory\ReviewService::class)->purgeReceipts())->dailyAt('03:30')->name('purge-review-receipts');

// Files from rejected and withdrawn civic reports are deleted after the retention period in Settings › Reports.
Schedule::call(fn () => app(\App\Services\Civic\IncidentService::class)->purgeExpiredEvidence())->dailyAt('03:45')->name('purge-incident-evidence');
