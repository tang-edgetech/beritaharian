<?php

namespace App\Http\Middleware;

use App\Exceptions\FriendlyException;
use App\Services\SettingService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks people whose role requires two-step sign-in until they have set it up.
 * The two-factor set-up routes themselves are not behind this middleware.
 */
class EnsureTwoFactorWhenRequired
{
    public function __construct(private SettingService $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $required = $this->settings->get('security', 'require_two_factor_roles', []);

        if ($user && ! $user->hasTwoFactorEnabled() && $user->hasAnyRole($required)) {
            throw new FriendlyException('Please turn on two-step sign-in to continue. Your role requires it.', 'TWO_FACTOR_SETUP_REQUIRED', 403);
        }

        return $next($request);
    }
}
