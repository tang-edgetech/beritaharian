<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\News\Category;
use Illuminate\Database\Seeder;

/**
 * Melaka's three districts with well-known localities, and starter news categories.
 * Safe to run again: existing rows are kept, so names edited in the admin are not overwritten.
 */
class NewsSeeder extends Seeder
{
    private const AREAS = [
        'melaka-tengah' => ['Melaka Tengah', 2.1960, 102.2480, [
            'bandar-hilir' => ['Bandar Hilir', 2.1925, 102.2501],
            'jonker-street' => ['Jonker Street', 2.1955, 102.2464],
            'klebang' => ['Klebang', 2.2160, 102.1980],
            'ayer-keroh' => ['Ayer Keroh', 2.2690, 102.2840],
            'bukit-baru' => ['Bukit Baru', 2.2190, 102.2560],
            'batu-berendam' => ['Batu Berendam', 2.2480, 102.2500],
            'bukit-katil' => ['Bukit Katil', 2.2280, 102.2930],
            'ujong-pasir' => ['Ujong Pasir', 2.1800, 102.2660],
        ]],
        'alor-gajah' => ['Alor Gajah', 2.3810, 102.2090, [
            'alor-gajah-town' => ['Alor Gajah town', 2.3810, 102.2090],
            'masjid-tanah' => ['Masjid Tanah', 2.3510, 102.1110],
            'tanjung-bidara' => ['Tanjung Bidara', 2.3010, 102.0920],
            'durian-tunggal' => ['Durian Tunggal', 2.3140, 102.2820],
        ]],
        'jasin' => ['Jasin', 2.3090, 102.4300, [
            'jasin-town' => ['Jasin town', 2.3090, 102.4300],
            'merlimau' => ['Merlimau', 2.1460, 102.4290],
            'bemban' => ['Bemban', 2.2700, 102.3800],
            'umbai' => ['Umbai', 2.1640, 102.3330],
        ]],
    ];

    private const CATEGORIES = [
        'local' => ['Local', 'What is happening around Melaka.', 'pandan'],
        'traffic' => ['Traffic & roads', 'Jams, road works, closures and floods on the road.', 'satay'],
        'food' => ['Food', 'New stalls, old favourites and food events.', 'marigold'],
        'events' => ['Events', 'Festivals, night markets and things to do.', 'gula'],
        'business' => ['Business', 'Openings, closures and local economy.', 'santan'],
        'community' => ['Community', 'People, schools, kampung news and good deeds.', 'pandan'],
        'weather' => ['Weather & alerts', 'Rain, haze, tides and official warnings.', 'satay'],
    ];

    public function run(): void
    {
        $districtPosition = 0;
        foreach (self::AREAS as $slug => [$name, $lat, $lng, $localities]) {
            $district = Area::firstOrCreate(['slug' => $slug], [
                'type' => Area::DISTRICT, 'name' => ['en' => $name], 'latitude' => $lat, 'longitude' => $lng, 'position' => $districtPosition++,
            ]);
            $position = 0;
            foreach ($localities as $childSlug => [$childName, $childLat, $childLng]) {
                Area::firstOrCreate(['slug' => $childSlug], [
                    'parent_id' => $district->id, 'type' => Area::LOCALITY, 'name' => ['en' => $childName],
                    'latitude' => $childLat, 'longitude' => $childLng, 'position' => $position++,
                ]);
            }
        }

        $position = 0;
        foreach (self::CATEGORIES as $slug => [$name, $description, $color]) {
            Category::firstOrCreate(['slug' => $slug], [
                'name' => ['en' => $name], 'description' => ['en' => $description], 'color' => $color, 'position' => $position++,
            ]);
        }
    }
}
