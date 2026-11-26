<?php

namespace App\Models\Civic;

use App\Services\SiteCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Translatable\HasTranslations;

/** A kind of incident readers can report: flood, road hazard, broken streetlight, crime... */
class IncidentType extends Model
{
    use HasTranslations, LogsActivity;

    public const COLORS = ['pandan', 'marigold', 'gula', 'satay', 'santan'];

    public array $translatable = ['name', 'description'];

    protected $fillable = ['name', 'description', 'slug', 'icon', 'color', 'default_severity', 'is_active', 'position'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('position')->orderBy('id');
    }

    protected static function booted(): void
    {
        $refresh = fn () => app(SiteCache::class)->refresh(['alerts', 'alert-types']);
        static::saved($refresh);
        static::deleted($refresh);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('civic')
            ->logOnly(['name', 'slug', 'icon', 'color', 'default_severity', 'is_active'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Incident type {$event}");
    }
}
