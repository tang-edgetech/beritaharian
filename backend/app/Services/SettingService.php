<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;

class SettingService
{
    private const CACHE_KEY = 'settings.all';

    /** @return array<string, array<string, mixed>> definitions from config/settings.php */
    public function definitions(): array
    {
        return config('settings');
    }

    public function groups(): array
    {
        return array_keys($this->definitions());
    }

    public function get(string $group, string $key, mixed $fallback = null): mixed
    {
        $values = $this->all();

        return Arr::get($values, "{$group}.{$key}", $fallback);
    }

    /** Saved values merged over defaults, for every group. */
    public function all(): array
    {
        $saved = Cache::rememberForever(self::CACHE_KEY, fn () => Setting::all()
            ->groupBy('group')
            ->map(fn ($rows) => $rows->pluck('value', 'key')->all())
            ->all());

        $result = [];
        foreach ($this->definitions() as $group => $keys) {
            foreach ($keys as $key => $definition) {
                $result[$group][$key] = array_key_exists($key, $saved[$group] ?? [])
                    ? $saved[$group][$key]
                    : $definition['default'];
            }
        }

        return $result;
    }

    public function group(string $group): array
    {
        return $this->all()[$group] ?? [];
    }

    /** Only the values the public site is allowed to read. */
    public function publicValues(): array
    {
        $all = $this->all();
        $public = [];
        foreach ($this->definitions() as $group => $keys) {
            foreach ($keys as $key => $definition) {
                if ($definition['public'] ?? false) {
                    $public[$group][$key] = $all[$group][$key];
                }
            }
        }

        return $public;
    }

    public function rules(string $group): array
    {
        return collect($this->definitions()[$group] ?? [])
            ->mapWithKeys(fn ($definition, $key) => [$key => $definition['rules']])
            ->all();
    }

    /** @return array<string, array{old: mixed, new: mixed}> what actually changed */
    public function update(string $group, array $values): array
    {
        $current = $this->group($group);
        $definitions = $this->definitions()[$group];
        $changes = [];

        foreach ($values as $key => $value) {
            if (! array_key_exists($key, $definitions) || $current[$key] === $value) {
                continue;
            }
            Setting::updateOrCreate(
                ['group' => $group, 'key' => $key],
                ['value' => $value, 'is_public' => $definitions[$key]['public'] ?? false],
            );
            $changes[$key] = ['old' => $current[$key], 'new' => $value];
        }

        Cache::forget(self::CACHE_KEY);

        return $changes;
    }
}
