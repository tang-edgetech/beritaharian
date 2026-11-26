<?php

namespace App\Models\Directory;

use App\Services\SiteCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Translatable\HasTranslations;

/**
 * A kind of place: Food & drink, Stays, Shops... Each sector lists the extra details its
 * businesses fill in (attribute_schema), e.g. halal and price band for food.
 *
 * attribute_schema: [{key, label, type: boolean|text|number|select|multiselect, options?: string[], unit?: string, filterable?: bool}]
 */
class Sector extends Model
{
    use HasTranslations, LogsActivity;

    public const COLORS = ['pandan', 'marigold', 'gula', 'satay', 'santan'];

    public const FIELD_TYPES = ['boolean', 'text', 'number', 'select', 'multiselect'];

    public array $translatable = ['name', 'description'];

    protected $fillable = ['parent_id', 'name', 'description', 'slug', 'icon', 'color', 'attribute_schema', 'is_active', 'position'];

    protected function casts(): array
    {
        return ['attribute_schema' => 'array', 'is_active' => 'boolean'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function businesses(): HasMany
    {
        return $this->hasMany(Business::class);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('position')->orderBy('id');
    }

    /** @return array<int, array{key: string, label: string, type: string, options?: array, unit?: string, filterable?: bool}> */
    public function fields(): array
    {
        return $this->attribute_schema ?? [];
    }

    protected static function booted(): void
    {
        static::saved(fn () => app(SiteCache::class)->refresh(['places', 'sectors']));
        static::deleted(fn () => app(SiteCache::class)->refresh(['places', 'sectors']));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('directory')
            ->logOnly(['name', 'slug', 'is_active', 'attribute_schema'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Sector {$event}");
    }
}
