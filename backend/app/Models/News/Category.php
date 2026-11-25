<?php

namespace App\Models\News;

use App\Services\SiteCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Translatable\HasTranslations;

/** A news section such as Local, Food, Traffic. Ordered by drag and drop. */
class Category extends Model
{
    use HasTranslations, LogsActivity;

    public const COLORS = ['pandan', 'marigold', 'gula', 'satay', 'santan'];

    public array $translatable = ['name', 'description'];

    protected $fillable = ['parent_id', 'name', 'description', 'slug', 'color', 'is_active', 'position'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function articles(): HasMany
    {
        return $this->hasMany(Article::class);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('position')->orderBy('id');
    }

    protected static function booted(): void
    {
        static::saved(fn () => app(SiteCache::class)->refresh(['news', 'categories']));
        static::deleted(fn () => app(SiteCache::class)->refresh(['news', 'categories']));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('news')
            ->logOnly(['name', 'slug', 'is_active', 'color'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Category {$event}");
    }
}
