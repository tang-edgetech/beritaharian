<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Tells the public site to drop cached pages after news changes, so a correction or a take-down
 * shows at once. Runs after the response is sent and never fails the staff member's action:
 * if the site can't be reached, pages still refresh on their own within a minute.
 */
class SiteCache
{
    /** @param  string[]  $tags  e.g. ['news', 'article-flash-flood'] */
    public function refresh(array $tags): void
    {
        $url = config('services.web.revalidate_url');
        $secret = config('services.web.revalidate_secret');
        if (! $url || ! $secret) {
            return;
        }

        dispatch(function () use ($url, $secret, $tags) {
            try {
                Http::timeout(3)->withHeaders(['X-Revalidate-Secret' => $secret])->post($url, ['tags' => array_values(array_unique($tags))]);
            } catch (Throwable $e) {
                Log::warning('Could not refresh the public site cache', ['error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
