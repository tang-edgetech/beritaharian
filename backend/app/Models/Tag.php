<?php

namespace App\Models;

use App\Models\News\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Support\Str;

class Tag extends Model
{
    protected $fillable = ['name', 'slug'];

    public function articles(): MorphToMany
    {
        return $this->morphedByMany(Article::class, 'taggable');
    }

    /** Finds or creates tags from what staff typed ("Jonker Street, banjir") and returns their ids. */
    public static function idsFor(array $names): array
    {
        return collect($names)
            ->map(fn ($name) => trim(preg_replace('/\s+/', ' ', (string) $name)))
            ->filter(fn ($name) => $name !== '' && mb_strlen($name) <= 60)
            ->unique(fn ($name) => Str::slug($name))
            ->map(fn ($name) => static::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name])->id)
            ->values()
            ->all();
    }
}
