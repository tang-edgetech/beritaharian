<?php

namespace Database\Seeders;

use App\Models\Civic\IncidentType;
use Illuminate\Database\Seeder;

/** Starter list of incident types for the report form. Staff can edit, reorder or turn them off in the admin. */
class IncidentTypeSeeder extends Seeder
{
    // slug => [name, description, icon (lucide), colour, default severity]
    private const TYPES = [
        'flood' => ['Flood', 'Roads or homes under water, rising rivers, flash floods.', 'waves', 'satay', 'high'],
        'accident' => ['Road accident', 'Crashes and vehicles blocking the road.', 'car-front', 'satay', 'high'],
        'fire' => ['Fire or smoke', 'Fires, open burning and heavy smoke.', 'flame', 'satay', 'critical'],
        'road-hazard' => ['Road hazard', 'Potholes, fallen trees, oil spills, missing drain covers.', 'construction', 'marigold', 'medium'],
        'streetlight' => ['Streetlight or traffic light', 'Lights that are out, flickering or damaged.', 'lamp', 'marigold', 'low'],
        'drain' => ['Blocked drain', 'Drains that are clogged, overflowing or smelly.', 'droplets', 'pandan', 'low'],
        'rubbish' => ['Illegal dumping', 'Rubbish left on roadsides, rivers or empty land.', 'trash-2', 'santan', 'low'],
        'safety' => ['Safety concern', 'Theft, break-ins or anything that feels unsafe. In an emergency, call 999 first.', 'shield-alert', 'gula', 'high'],
        'animals' => ['Stray or injured animals', 'Animals that are hurt, aggressive or blocking the road.', 'paw-print', 'santan', 'low'],
        'other' => ['Something else', 'Anything else the community should know about.', 'circle-help', 'santan', 'medium'],
    ];

    public function run(): void
    {
        $position = 0;
        foreach (self::TYPES as $slug => [$name, $description, $icon, $color, $severity]) {
            IncidentType::firstOrCreate(['slug' => $slug], [
                'name' => ['en' => $name],
                'description' => ['en' => $description],
                'icon' => $icon,
                'color' => $color,
                'default_severity' => $severity,
                'position' => $position++,
            ]);
        }
    }
}
