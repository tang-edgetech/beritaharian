<?php

namespace Database\Seeders;

use App\Models\Civic\Incident;
use App\Models\User;
use App\Services\Civic\IncidentService;
use Illuminate\Database\Seeder;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Made-up civic reports for trying out the verifier queue and the public alerts. Local only, never in production.
 *   php artisan db:seed --class=DemoIncidentsSeeder
 * Remove them again with:
 *   php artisan tinker --execute "App\Models\Civic\Incident::withTrashed()->where('title', 'like', '%(sample)')->get()->each(function (\$i) { Illuminate\Support\Facades\Storage::disk('local')->deleteDirectory('incidents/'.\$i->ulid); \$i->publicPhotos->each->delete(); \$i->forceDelete(); });"
 * Every title ends in "(sample)".
 */
class DemoIncidentsSeeder extends Seeder
{
    // [type, title, lat, lng, place, hours ago, outcome, public summary]
    private const REPORTS = [
        ['flood', 'Jalan Hang Jebat under water', 2.19530, 102.24710, 'Jalan Hang Jebat', 3, 'alert', 'Water about 40 cm deep after heavy rain. Drivers are advised to use Jalan Kota until it drains.'],
        ['road-hazard', 'Fallen tree blocking one lane', 2.21900, 102.20300, 'Jalan Klebang Besar', 7, 'alert', 'A fallen tree is blocking the left lane towards Tanjung Kling. Council workers are on the way.'],
        ['fire', 'Smoke from open burning', 2.31500, 102.43200, 'Near Jasin town', 52, 'resolved', 'Open burning on empty land caused heavy smoke. The fire brigade put it out.'],
        ['streetlight', 'Three streetlights out near the roundabout', 2.18900, 102.25300, 'Bandar Hilir', 20, 'new', null],
        ['drain', 'Drain overflowing after every rain', 2.26000, 102.27900, 'Ayer Keroh', 30, 'needs_info', null],
        ['accident', 'Two cars crashed at the junction', 2.20400, 102.25900, 'Melaka Raya', 2, 'investigating', null],
        ['rubbish', 'Rubbish dumped by the river', 2.38200, 102.20900, 'Alor Gajah', 70, 'rejected', null],
        ['road-hazard', 'Deep pothole near the school', 2.22700, 102.27200, 'Batu Berendam', 10, 'new', null],
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('Sample reports are for local testing only.');

            return;
        }
        $this->call(IncidentTypeSeeder::class);
        config(['mail.default' => 'array']); // don't email the sample readers

        $verifier = User::firstOrCreate(['email' => 'sample.verifier@cendolsatay.test'], [
            'name' => 'Sample Verifier', 'password' => Str::password(24), 'status' => User::STATUS_ACTIVE, 'email_verified_at' => now(),
        ]);
        $verifier->syncRoles(['verifier']);
        $readers = collect(['Sample Reader One', 'Sample Reader Two', 'Sample Reader Three'])->map(fn ($name, $i) => User::firstOrCreate(
            ['email' => 'sample.reader'.($i + 1).'@cendolsatay.test'],
            ['name' => $name, 'password' => Str::password(24), 'status' => User::STATUS_ACTIVE, 'email_verified_at' => now()],
        ));
        $service = app(IncidentService::class);
        $request = Request::create('/', 'POST', server: ['REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'DemoIncidentsSeeder']);

        foreach (self::REPORTS as $index => [$type, $title, $lat, $lng, $place, $hoursAgo, $outcome, $summary]) {
            $fullTitle = "{$title} (sample)";
            if (Incident::withTrashed()->where('title', $fullTitle)->exists()) {
                continue;
            }
            $incident = $service->submit($readers[$index % 3], [
                'type' => $type,
                'latitude' => $lat,
                'longitude' => $lng,
                'address' => "Near {$place}",
                'occurred_at' => now()->subHours($hoursAgo),
                'title' => $fullTitle,
                'description' => "This is a made-up report for trying out civic reports. {$title} at {$place}.",
                'is_anonymous' => $index % 2 === 0,
            ], [$this->photo($title, $index)], $request);

            match ($outcome) {
                'alert', 'resolved' => $service->verify($incident, $verifier, [
                    'severity' => $type === 'fire' ? 'high' : null,
                    'checklist' => ['location_matches' => true, 'time_plausible' => true, 'not_reused' => true, 'no_accusation' => true],
                    'publish_alert' => true,
                    'public_title' => "{$title} (sample)",
                    'public_summary' => $summary,
                    'public_address' => $place,
                ]),
                'needs_info' => $service->requestInfo($incident, $verifier, 'Could you send a photo showing the street name, so we can find the exact drain?'),
                'investigating' => $service->investigate($incident, $verifier, 'Checking with the traffic police.'),
                'rejected' => $service->reject($incident, $verifier, 'This sample report is closed to show how a rejection looks.'),
                default => null,
            };
            if ($outcome === 'resolved') {
                $service->close($incident->fresh(), $verifier, 'The fire is out.');
            }
        }
        $this->command?->info('Sample reports added. Every title ends in "(sample)".');
    }

    /** A plain coloured picture with the title on it, standing in for a phone photo. */
    private function photo(string $title, int $index): UploadedFile
    {
        $image = imagecreatetruecolor(960, 720);
        $colors = [[31, 107, 74], [240, 180, 67], [194, 59, 46], [104, 92, 80]];
        [$r, $g, $b] = $colors[$index % 4];
        imagefill($image, 0, 0, imagecolorallocate($image, $r, $g, $b));
        imagestring($image, 5, 40, 340, Str::limit($title, 60), imagecolorallocate($image, 255, 250, 240));
        imagestring($image, 3, 40, 380, 'Sample photo - Cendol Satay', imagecolorallocate($image, 255, 250, 240));
        $path = tempnam(sys_get_temp_dir(), 'inc').'.jpg';
        imagejpeg($image, $path, 85);
        imagedestroy($image);

        return new UploadedFile($path, Str::slug($title).'.jpg', 'image/jpeg', null, true);
    }
}
