<?php

namespace App\Services\Directory;

use App\Exceptions\FriendlyException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Turns an address into map coordinates. Uses OpenStreetMap's Nominatim for now (free, one request
 * a second, results cached for a week). When the business moves to Google, only this class changes.
 */
class Geocoder
{
    /** @return array<int, array{label: string, latitude: float, longitude: float}> */
    public function search(string $query): array
    {
        $query = trim($query);
        if (mb_strlen($query) < 3) {
            return [];
        }

        return Cache::remember('geocode:'.md5(mb_strtolower($query)), now()->addWeek(), function () use ($query) {
            try {
                $response = Http::timeout(8)
                    ->withHeaders(['User-Agent' => config('app.name', 'Cendol Satay').' directory (admin address lookup)'])
                    ->get(config('services.geocoding.url', 'https://nominatim.openstreetmap.org/search'), [
                        'q' => $query,
                        'format' => 'jsonv2',
                        'countrycodes' => 'my',
                        'viewbox' => '101.95,2.55,102.65,1.95', // Melaka first
                        'limit' => 5,
                    ]);
            } catch (Throwable) {
                throw new FriendlyException('The address search isn’t answering right now. You can still drop the pin on the map.', 'GEOCODER_DOWN', 503);
            }
            if (! $response->ok()) {
                throw new FriendlyException('The address search isn’t answering right now. You can still drop the pin on the map.', 'GEOCODER_DOWN', 503);
            }

            return collect($response->json())->map(fn ($r) => [
                'label' => (string) ($r['display_name'] ?? ''),
                'latitude' => (float) $r['lat'],
                'longitude' => (float) $r['lon'],
            ])->values()->all();
        });
    }
}
