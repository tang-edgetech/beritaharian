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
