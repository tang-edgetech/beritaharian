<?php

namespace Database\Seeders;

use App\Models\Directory\Sector;
use App\Services\Directory\DetailSchema;
use Illuminate\Database\Seeder;

/**
 * Starter sectors for the places directory, each with the details its listings fill in.
 * Safe to run again: existing sectors are kept, so changes made in the admin are not overwritten.
 */
class DirectorySeeder extends Seeder
{
    private const SECTORS = [
        'food-drink' => ['Food & drink', 'Restaurants, hawker stalls, cafés and kopitiams.', 'utensils', 'marigold', [
            ['label' => 'Halal', 'type' => 'boolean', 'filterable' => true],
            ['label' => 'Cuisine', 'type' => 'multiselect', 'options' => ['Malay', 'Chinese', 'Nyonya', 'Indian', 'Portuguese', 'Western', 'Seafood', 'Desserts', 'Vegetarian'], 'filterable' => true],
            ['label' => 'Price range', 'type' => 'select', 'options' => ['RM', 'RM RM', 'RM RM RM'], 'filterable' => true],
            ['label' => 'Air-conditioned', 'type' => 'boolean'],
            ['label' => 'Seats', 'type' => 'number'],
        ]],
        'stays' => ['Stays', 'Hotels, guesthouses and homestays.', 'bed-double', 'pandan', [
            ['label' => 'Type', 'type' => 'select', 'options' => ['Hotel', 'Guesthouse', 'Homestay', 'Resort', 'Hostel'], 'filterable' => true],
            ['label' => 'Star rating', 'type' => 'number', 'unit' => 'stars'],
            ['label' => 'Rooms', 'type' => 'number'],
            ['label' => 'Free parking', 'type' => 'boolean', 'filterable' => true],
            ['label' => 'Swimming pool', 'type' => 'boolean', 'filterable' => true],
        ]],
        'things-to-do' => ['Things to do', 'Museums, attractions, parks and tours.', 'landmark', 'gula', [
            ['label' => 'Entry', 'type' => 'select', 'options' => ['Free', 'Paid'], 'filterable' => true],
            ['label' => 'Good for kids', 'type' => 'boolean', 'filterable' => true],
            ['label' => 'Wheelchair access', 'type' => 'boolean', 'filterable' => true],
        ]],
        'shops' => ['Shops', 'Markets, souvenir shops, groceries and everyday shopping.', 'shopping-bag', 'satay', [
            ['label' => 'What they sell', 'type' => 'multiselect', 'options' => ['Souvenirs', 'Groceries', 'Clothing', 'Electronics', 'Hardware', 'Books', 'Local produce'], 'filterable' => true],
            ['label' => 'Accepts e-wallet', 'type' => 'boolean', 'filterable' => true],
        ]],
        'services' => ['Services', 'Workshops, salons, laundries, tuition and repairs.', 'wrench', 'santan', [
            ['label' => 'Service', 'type' => 'select', 'options' => ['Car & motorcycle', 'Hair & beauty', 'Laundry', 'Repairs', 'Tuition', 'Printing', 'Other'], 'filterable' => true],
            ['label' => 'Home visits', 'type' => 'boolean', 'filterable' => true],
        ]],
        'health' => ['Health', 'Clinics, pharmacies and dentists.', 'stethoscope', 'pandan', [
            ['label' => 'Kind', 'type' => 'select', 'options' => ['Clinic', 'Pharmacy', 'Dentist', 'Hospital', 'Physiotherapy'], 'filterable' => true],
            ['label' => 'Walk-ins welcome', 'type' => 'boolean', 'filterable' => true],
            ['label' => 'Panel insurance', 'type' => 'boolean'],
        ]],
    ];

    public function run(): void
    {
        $position = 0;
        foreach (self::SECTORS as $slug => [$name, $description, $icon, $color, $fields]) {
            Sector::firstOrCreate(['slug' => $slug], [
                'name' => ['en' => $name],
                'description' => ['en' => $description],
                'icon' => $icon,
                'color' => $color,
                'attribute_schema' => DetailSchema::cleanFields($fields),
                'position' => $position++,
            ]);
        }
    }
}
