<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SettingController extends Controller
{
    public function __construct(private SettingService $settings) {}

    public function show(string $group): JsonResponse
    {
        $this->ensureGroup($group);

        return response()->json(['group' => $group, 'data' => $this->settings->group($group)]);
    }

    public function update(Request $request, string $group): JsonResponse
    {
        $this->ensureGroup($group);
        $data = $request->validate($this->settings->rules($group));

        $changes = $this->settings->update($group, $data);

        if ($changes) {
            activity('settings')->causedBy($request->user())->event('updated')
                ->withProperties([
                    'group' => $group,
                    'old' => collect($changes)->map->old->all(),
                    'attributes' => collect($changes)->map->new->all(),
                ])
                ->log(Str::headline($group).' settings changed');
        }

        return response()->json([
            'message' => $changes ? Str::headline($group).' settings saved.' : 'Nothing changed.',
            'data' => $this->settings->group($group),
        ]);
    }

    /** Public, no sign-in: only values marked public in config/settings.php */
    public function public(): JsonResponse
    {
        return response()->json(['data' => $this->settings->publicValues()]);
    }

    private function ensureGroup(string $group): void
    {
        if (! in_array($group, $this->settings->groups(), true)) {
            throw new FriendlyException("We couldn't find that settings page.", 'NOT_FOUND', 404);
        }
    }
}
