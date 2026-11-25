<?php

namespace App\Http\Controllers;

use App\Services\SettingService;
use Illuminate\Http\Request;

abstract class Controller
{
    /** Items per page for listings: only 10, 25, 50 or 100; otherwise the site default. */
    protected function perPage(Request $request): int
    {
        $requested = (int) $request->query('per_page');

        return in_array($requested, [10, 25, 50, 100], true)
            ? $requested
            : (int) app(SettingService::class)->get('extra', 'items_per_page_default', 25);
    }
}
