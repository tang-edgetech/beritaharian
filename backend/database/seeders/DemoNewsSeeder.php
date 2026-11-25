<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\News\Article;
use App\Models\News\Category;
use App\Models\Tag;
use App\Models\User;
use App\Services\MediaService;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Sample stories for trying the site locally. NOT run by default and refuses to run in production.
 *   php artisan db:seed --class=DemoNewsSeeder
 * Remove them again with:
 *   php artisan tinker --execute "App\Models\News\Article::whereHas('tags', fn ($q) => $q->where('slug', 'sample'))->get()->each->forceDelete();"
 * Every story says in its first line that it is a made-up sample.
 */
class DemoNewsSeeder extends Seeder
{
    private const STORIES = [
        ['Night market at Jonker Street adds 20 new stalls for the school holidays', 'events', 'jonker-street', '#f0b443', '#c8601f', true],
        ['Afternoon storm floods three roads in Bandar Hilir', 'weather', 'bandar-hilir', '#2b8a5f', '#113a29', false],
        ['Klebang coconut shake stall celebrates 25 years', 'food', 'klebang', '#f5c562', '#9a5324', false],
        ['Road works on Jalan Ayer Keroh to finish by Friday', 'traffic', 'ayer-keroh', '#d8742c', '#4a2511', false],
        ['Merlimau school volunteers clean up the river bank', 'community', 'merlimau', '#74bb95', '#1f6b4a', false],
        ['New café opens inside a restored shophouse on Heeren Street', 'business', 'jonker-street', '#e6c3a2', '#643215', false],
        ['Masjid Tanah kampung hosts its first durian festival', 'events', 'masjid-tanah', '#a9d6bd', '#237a53', false],
        ['Haze readings rise slightly across Melaka Tengah', 'weather', 'melaka-tengah', '#cec4b8', '#52483f', false],
        ['Umbai seafood restaurants report a busy weekend', 'food', 'umbai', '#f9d993', '#b57716', false],
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Sample stories are for local testing only.');
        }

        $reporter = User::firstOrCreate(['email' => 'sample.reporter@cendolsatay.test'], [
            'name' => 'Sample Reporter', 'password' => Str::password(24), 'status' => User::STATUS_ACTIVE, 'email_verified_at' => now(),
        ]);
        $reporter->assignRole('journalist');
        $sampleTag = Tag::idsFor(['sample']);
        $media = app(MediaService::class);

        foreach (self::STORIES as $index => [$title, $category, $area, $light, $dark, $breaking]) {
            $slug = Str::slug($title);
            if (Article::withTrashed()->where('slug', $slug)->exists()) {
                continue;
            }

            $article = new Article([
                'author_id' => $reporter->id,
                'category_id' => Category::where('slug', $category)->value('id'),
                'area_id' => Area::where('slug', $area)->value('id'),
                'title' => ['en' => $title],
                'slug' => $slug,
                'excerpt' => ['en' => 'Sample story for trying out the site. The details are made up.'],
                'body' => ['en' => $this->body($title)],
                'is_breaking' => $breaking,
            ]);
            $article->forceFill([
                'status' => Article::PUBLISHED,
                'truth_label' => $breaking ? Article::LABEL_DEVELOPING : Article::LABEL_VERIFIED,
                'published_at' => now()->subHours($index * 5 + 1),
                'published_by' => $reporter->id,
                'search_text' => $title,
                'reading_minutes' => 2,
                'view_count' => 40 * (9 - $index),
            ])->save();
            $article->tags()->sync($sampleTag);

            $cover = $media->storeImage($this->coverImage($light, $dark, $index), 'cover', null, ['alt' => 'Sample cover picture']);
            $cover->forceFill(['mediable_type' => $article->getMorphClass(), 'mediable_id' => $article->id])->save();
        }
    }

    private function body(string $title): array
    {
        $p = fn (string $text) => ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]];

        return ['type' => 'doc', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'This is a sample story for trying out the site. The people, places and details are made up.', 'marks' => [['type' => 'italic']]]]],
            $p("{$title}. Readers would see the full story here: what happened, who said what, and what it means for people in the area."),
            ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => 'What happens next']]],
            $p('A second section shows how headings break up longer stories so they are easy to read on a phone.'),
            ['type' => 'bulletList', 'content' => [
                ['type' => 'listItem', 'content' => [$p('Lists are useful for times, places and road closures.')]],
                ['type' => 'listItem', 'content' => [$p('Each story names its sources at the end.')]],
            ]],
            ['type' => 'blockquote', 'content' => [$p('Quotes from people at the scene stand out like this.')]],
        ]];
    }

    /** A simple two-colour picture so sample cards are not blank. */
    private function coverImage(string $light, string $dark, int $seed): UploadedFile
    {
        $w = 1600;
        $h = 1000;
        $img = imagecreatetruecolor($w, $h);
        [$r1, $g1, $b1] = sscanf($light, '#%02x%02x%02x');
        [$r2, $g2, $b2] = sscanf($dark, '#%02x%02x%02x');
        for ($y = 0; $y < $h; $y++) {
            $t = $y / $h;
            $color = imagecolorallocate($img, (int) ($r1 + ($r2 - $r1) * $t), (int) ($g1 + ($g2 - $g1) * $t), (int) ($b1 + ($b2 - $b1) * $t));
            imageline($img, 0, $y, $w, $y, $color);
        }
        $sun = imagecolorallocatealpha($img, 255, 250, 240, 70);
        imagefilledellipse($img, 1150 + ($seed * 37) % 300, 320, 420, 420, $sun);
        $hill = imagecolorallocatealpha($img, $r2, $g2, $b2, 30);
        imagefilledellipse($img, 400 + ($seed * 53) % 500, 1050, 1400, 600, $hill);

        $path = tempnam(sys_get_temp_dir(), 'cover').'.png';
        imagepng($img, $path);
        imagedestroy($img);

        return new UploadedFile($path, 'sample.png', 'image/png', null, true);
    }
}
