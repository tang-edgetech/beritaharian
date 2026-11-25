<?php

namespace App\Services;

use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

/**
 * Saves uploaded pictures as three WebP sizes so phones download small files:
 * thumb (480px wide), card (960px) and large (1600px). The original is not kept,
 * which also drops camera location data from the file.
 */
class MediaService
{
    private const SIZES = ['thumb' => 480, 'card' => 960, 'large' => 1600];

    public function storeImage(UploadedFile $file, string $collection, ?User $user, array $meta = []): Media
    {
        $manager = new ImageManager(new Driver);
        $image = $manager->read($file->getRealPath())->orient();
        $width = $image->width();
        $height = $image->height();

        $directory = now()->format('Y/m').'/'.Str::lower((string) Str::ulid());
        $disk = Storage::disk('media');
        $variants = [];
        $bytes = 0;

        foreach (self::SIZES as $name => $max) {
            $copy = (clone $image);
            if ($copy->width() > $max) {
                $copy->scale(width: $max);
            }
            $encoded = (string) $copy->toWebp(quality: 80);
            $filename = "{$name}.webp";
            $disk->put("{$directory}/{$filename}", $encoded);
            $variants[$name] = $filename;
            $bytes += strlen($encoded);
        }

        return Media::create([
            'collection' => $collection,
            'disk' => 'media',
            'directory' => $directory,
            'variants' => $variants,
            'mime' => 'image/webp',
            'size' => $bytes,
            'meta' => array_merge(['width' => $width, 'height' => $height], array_filter($meta, fn ($v) => $v !== null && $v !== '')),
            'uploaded_by' => $user?->id,
        ]);
    }

    public function baseUrl(): string
    {
        return rtrim(Storage::disk('media')->url(''), '/');
    }
}
