<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Super admins pass every permission check.
        Gate::before(fn (User $user) => $user->hasRole('super-admin') ? true : null);

        // Sign-in, sign-up and code endpoints: 20 requests a minute per IP.
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(20)->by($request->ip()));

        // Public reading: generous for people, still stops scrapers hammering the API.
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(240)->by($request->ip()));
        RateLimiter::for('views', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
    }
}
