<?php

use App\Models\OtpCode;
use Illuminate\Support\Facades\Schedule;

// cPanel cron, every minute:  php /home/USER/backend/artisan schedule:run >> /dev/null 2>&1
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::call(fn () => OtpCode::where('created_at', '<', now()->subDays(2))->delete())->daily()->name('prune-otp-codes');
Schedule::command('queue:work --stop-when-empty --max-time=55')->everyMinute()->withoutOverlapping();
