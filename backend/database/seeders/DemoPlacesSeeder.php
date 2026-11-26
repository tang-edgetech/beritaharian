<?php

namespace Database\Seeders;

use App\Models\Directory\Business;
use App\Models\Directory\Review;
use App\Models\User;
use App\Services\Directory\BusinessService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Made-up places for trying Peta Melaka locally. NOT run by default and refuses to run in production.
 *   php artisan db:seed --class=DemoPlacesSeeder
 * Remove them again with:
 *   php artisan tinker --execute "App\Models\Directory\Business::withTrashed()->where('submitted_note', 'sample')->get()->each->forceDelete();"
 * Every name ends in "(sample)" and every description says the place is made up.
 */
class DemoPlacesSeeder extends Seeder
{
    // name, sector, area, lat, lng, address, details, hours preset
    private const PLACES = [
        ['Kopitiam Contoh', 'food-drink', 'jonker-street', 2.19530, 102.24710, 'Jalan Hang Jebat', ['halal' => false, 'cuisine' => ['Chinese', 'Nyonya'], 'price_range' => 'RM'], 'breakfast'],
        ['Nasi Lemak Pagi Contoh', 'food-drink', 'bandar-hilir', 2.19180, 102.25140, 'Jalan Parameswara', ['halal' => true, 'cuisine' => ['Malay'], 'price_range' => 'RM'], 'breakfast'],
        ['Rumah Nyonya Contoh', 'food-drink', 'jonker-street', 2.19620, 102.24560, 'Jalan Tun Tan Cheng Lock', ['halal' => false, 'cuisine' => ['Nyonya'], 'price_range' => 'RM RM', 'air_conditioned' => true, 'seats' => 40], 'lunch-dinner'],
        ['Ikan Bakar Pantai Contoh', 'food-drink', 'umbai', 2.16420, 102.33380, 'Jalan Pantai Umbai', ['halal' => true, 'cuisine' => ['Seafood', 'Malay'], 'price_range' => 'RM RM'], 'evening'],
        ['Cendol Gerai Contoh', 'food-drink', 'klebang', 2.21610, 102.19830, 'Jalan Klebang Besar', ['halal' => true, 'cuisine' => ['Desserts'], 'price_range' => 'RM'], 'daytime'],
        ['Satay Celup Malam Contoh', 'food-drink', 'bukit-baru', 2.21900, 102.25590, 'Jalan Bukit Baru', ['halal' => false, 'cuisine' => ['Chinese'], 'price_range' => 'RM RM'], 'late'],
        ['Rumah Tamu Heeren Contoh', 'stays', 'jonker-street', 2.19470, 102.24620, 'Jalan Tun Tan Cheng Lock', ['type' => 'Guesthouse', 'rooms' => 12, 'free_parking' => false], 'always'],
        ['Hotel Sungai Contoh', 'stays', 'bandar-hilir', 2.19790, 102.25010, 'Jalan Merdeka', ['type' => 'Hotel', 'star_rating' => 4, 'rooms' => 180, 'free_parking' => true, 'swimming_pool' => true], 'always'],
        ['Muzium Kecil Contoh', 'things-to-do', 'bandar-hilir', 2.19290, 102.24930, 'Jalan Kota', ['entry' => 'Paid', 'good_for_kids' => true, 'wheelchair_access' => true], 'museum'],
        ['Taman Tepi Laut Contoh', 'things-to-do', 'klebang', 2.21890, 102.19400, 'Pantai Klebang', ['entry' => 'Free', 'good_for_kids' => true], 'always'],
        ['Kedai Cenderamata Contoh', 'shops', 'jonker-street', 2.19570, 102.24650, 'Jalan Hang Jebat', ['what_they_sell' => ['Souvenirs', 'Local produce'], 'accepts_e_wallet' => true], 'daytime'],
        ['Bengkel Motor Contoh', 'services', 'batu-berendam', 2.24790, 102.25030, 'Jalan Batu Berendam', ['service' => 'Car & motorcycle', 'home_visits' => false], 'weekday'],
        ['Klinik Keluarga Contoh', 'health', 'ayer-keroh', 2.26880, 102.28410, 'Jalan Ayer Keroh Lama', ['kind' => 'Clinic', 'walk_ins_welcome' => true, 'panel_insurance' => true], 'clinic'],
        ['Farmasi Contoh', 'health', 'bukit-katil', 2.22810, 102.29280, 'Jalan Bukit Katil', ['kind' => 'Pharmacy', 'walk_ins_welcome' => true], 'weekday'],
    ];

    private const HOURS = [
        'breakfast' => [[1, 6, '06:30', '14:00']],
        'lunch-dinner' => [[2, 0, '11:30', '15:00'], [2, 0, '17:30', '21:30']],
        'evening' => [[1, 0, '17:00', '23:00']],
        'daytime' => [[1, 0, '10:00', '18:00']],
        'late' => [[0, 6, '18:00', '02:00']],
        'always' => [[0, 6, '00:00', '24:00']],
        'museum' => [[2, 0, '09:00', '17:30']],
        'weekday' => [[1, 6, '09:00', '18:00']],
        'clinic' => [[1, 5, '08:30', '21:00'], [6, 6, '08:30', '13:00']],
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Sample places are for local testing only.');
        }
        $this->call(DirectorySeeder::class);

        $staff = User::firstOrCreate(['email' => 'sample.reporter@cendolsatay.test'], [
            'name' => 'Sample Reporter', 'password' => Str::password(24), 'status' => User::STATUS_ACTIVE, 'email_verified_at' => now(),
        ]);
        $readers = collect(['Sample Reader One', 'Sample Reader Two', 'Sample Reader Three'])->map(fn ($name, $i) => User::firstOrCreate(
            ['email' => 'sample.reader'.($i + 1).'@cendolsatay.test'],
            ['name' => $name, 'password' => Str::password(24), 'status' => User::STATUS_ACTIVE, 'email_verified_at' => now()],
        ));
        $service = app(BusinessService::class);

        foreach (self::PLACES as $index => [$name, $sector, $area, $lat, $lng, $street, $details, $preset]) {
            $fullName = "{$name} (sample)";
            if (Business::withTrashed()->where('slug', Str::slug($fullName))->exists()) {
                continue;
            }
            $hours = collect(self::HOURS[$preset])->flatMap(fn ($p) => collect($this->days($p[0], $p[1]))->map(fn ($d) => ['day' => $d, 'opens' => $p[2], 'closes' => $p[3]]))->all();

            $business = $service->save(null, [
                'sector' => $sector,
                'name' => $fullName,
                'description' => 'This is a made-up place for trying out Peta Melaka. The name, details and reviews are samples.',
                'details' => $details,
                'contacts' => ['phone' => '06-000 '.str_pad((string) (1000 + $index), 4, '0'), 'whatsapp' => null],
                'status' => Business::ACTIVE,
                'locations' => [[
                    'address' => (10 + $index * 3).', '.$street.', Melaka',
                    'postcode' => '75'.str_pad((string) (100 + $index * 7), 3, '0'),
                    'area' => $area,
                    'latitude' => $lat,
                    'longitude' => $lng,
                    'is_primary' => true,
                    'hours' => $hours,
                ]],
            ], $staff);
            $business->forceFill(['submitted_note' => 'sample'])->saveQuietly();

            // a few visible reviews so stars and lists are not empty
            foreach ($readers->take(($index % 3) + 1) as $r => $reader) {
                $review = Review::create([
                    'business_id' => $business->id,
                    'user_id' => $reader->id,
                    'rating' => [5, 4, 3][($index + $r) % 3],
                    'sub_ratings' => ['service' => 4, 'value' => [5, 4, 3][$r % 3], 'cleanliness' => 4],
                    'body' => 'Sample review for trying out the site. Friendly staff, fair prices and easy to find. The details are made up.',
                    'visited_on' => now()->subDays(5 + $r * 3)->toDateString(),
                    'is_anonymous' => $r === 2,
                    'status' => Review::VISIBLE,
                ]);
                $review->forceFill(['is_verified_visit' => true, 'published_at' => now()->subDays(4 + $r * 3)])->saveQuietly();
                $review->proof()->create(['kind' => 'checkin', 'status' => 'confirmed', 'distance_m' => 20, 'verified_at' => now()]);
            }
            $service->refreshRating($business);
        }
    }

    /** Days from $from to $to going forward through the week, e.g. 1..6 = Monday to Saturday, 2..0 = Tuesday to Sunday. */
    private function days(int $from, int $to): array
    {
        $days = [$from];
        $d = $from;
        while ($d !== $to) {
            $d = ($d + 1) % 7;
            $days[] = $d;
        }

        return $days;
    }
}
