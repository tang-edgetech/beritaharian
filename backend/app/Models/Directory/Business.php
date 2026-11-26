<?php

namespace App\Models\Directory;

use App\Models\Media;
use App\Models\User;
use App\Services\SiteCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Translatable\HasTranslations;

/** A business or place in the directory, with one or more branches on the map. */
class Business extends Model
{
    use HasTranslations, HasUlids, LogsActivity, SoftDeletes;

    public const PENDING = 'pending';

    public const ACTIVE = 'active';

    public const SUSPENDED = 'suspended';

    public const STATUSES = [self::PENDING, self::ACTIVE, self::SUSPENDED];

    public const CONTACT_KEYS = ['phone', 'whatsapp', 'email', 'website', 'facebook', 'instagram', 'tiktok'];

    public array $translatable = ['name', 'description'];

    protected $fillable = ['sector_id', 'name', 'slug', 'description', 'ssm_number', 'details', 'contacts', 'status', 'submitted_note', 'created_by'];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'contacts' => 'array',
            'is_claimed' => 'boolean',
            'rating_avg' => 'float',
            'rating_count' => 'integer',
            'approved_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(BusinessLocation::class)->orderByDesc('is_primary')->orderBy('position')->orderBy('id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'business_members')->withPivot('role')->withTimestamps();
    }

    public function claims(): HasMany
    {
        return $this->hasMany(BusinessClaim::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function logo(): MorphOne
    {
        return $this->morphOne(Media::class, 'mediable')->where('collection', 'logo');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable')->where('collection', 'gallery')->orderBy('position');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::ACTIVE);
    }

    public function isManagedBy(?User $user): bool
    {
        return $user !== null && $this->members()->whereKey($user->id)->exists();
    }

    public function displayName(): string
    {
        return (string) $this->getTranslation('name', 'en');
    }

    protected static function booted(): void
    {
        $refresh = fn (Business $b) => app(SiteCache::class)->refresh(['places', "place-{$b->slug}"]);
        static::saved($refresh);
        static::deleted($refresh);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('directory')
            ->logOnly(['name', 'slug', 'status', 'sector_id', 'description', 'details', 'contacts', 'is_claimed', 'moderation_note'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Place {$event}");
    }
}
