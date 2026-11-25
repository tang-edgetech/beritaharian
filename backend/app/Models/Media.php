<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;

/** A picture, stored as resized WebP copies (thumb, card, large). Shared by articles now and listings later. */
class Media extends Model
{
    use HasUlids;

    protected $fillable = ['mediable_type', 'mediable_id', 'collection', 'disk', 'directory', 'variants', 'mime', 'size', 'meta', 'position', 'uploaded_by'];

    protected function casts(): array
    {
        return ['variants' => 'array', 'meta' => 'array'];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function mediable(): MorphTo
    {
        return $this->morphTo();
    }

    public function url(string $variant = 'card'): ?string
    {
        $file = $this->variants[$variant] ?? $this->variants['large'] ?? null;

        return $file ? Storage::disk($this->disk)->url("{$this->directory}/{$file}") : null;
    }

    /** Shape sent to the front ends. */
    public function toPublic(): array
    {
        return [
            'id' => $this->ulid,
            'thumb' => $this->url('thumb'),
            'card' => $this->url('card'),
            'large' => $this->url('large'),
            'width' => $this->meta['width'] ?? null,
            'height' => $this->meta['height'] ?? null,
            'alt' => $this->meta['alt'] ?? '',
            'caption' => $this->meta['caption'] ?? null,
            'credit' => $this->meta['credit'] ?? null,
        ];
    }

    protected static function booted(): void
    {
        static::deleted(fn (Media $media) => Storage::disk($media->disk)->deleteDirectory($media->directory));
    }
}
