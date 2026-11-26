<?php

namespace App\Models\Directory;

use App\Models\Media;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * A review after a visit. Every review carries proof: a receipt photo (checked by a moderator,
 * never shown publicly) or an on-site check-in (confirmed automatically within 150 m).
 */
class Review extends Model
{
    use HasUlids, LogsActivity, SoftDeletes;

    public const PENDING = 'pending';

    public const HELD = 'held';

    public const RETURNED = 'returned';

    public const VISIBLE = 'visible';

    public const REMOVED = 'removed';

    public const STATUSES = [self::PENDING, self::HELD, self::RETURNED, self::VISIBLE, self::REMOVED];

    public const SUB_RATINGS = ['service', 'value', 'cleanliness'];

    public const REPORT_REASONS = [
        'fake' => 'Fake or not a real visit',
        'offensive' => 'Rude or hateful',
        'personal' => 'Shares personal information',
        'unrelated' => 'Not about this place',
        'other' => 'Something else',
    ];

    protected $fillable = ['business_id', 'business_location_id', 'user_id', 'rating', 'sub_ratings', 'title', 'body', 'visited_on', 'is_anonymous', 'status', 'flags'];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'sub_ratings' => 'array',
            'flags' => 'array',
            'visited_on' => 'date',
            'is_anonymous' => 'boolean',
            'is_verified_visit' => 'boolean',
            'helpful_count' => 'integer',
            'open_reports' => 'integer',
            'moderated_at' => 'datetime',
            'published_at' => 'datetime',
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

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class)->withTrashed();
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(BusinessLocation::class, 'business_location_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function moderator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'moderated_by')->withTrashed();
    }

    public function proof(): HasOne
    {
        return $this->hasOne(VisitProof::class);
    }

    public function reply(): HasOne
    {
        return $this->hasOne(ReviewReply::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(ReviewReport::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(ReviewVote::class);
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable')->where('collection', 'review')->orderBy('position');
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', self::VISIBLE);
    }

    /** Name shown in public: the writer's name, unless they chose to hide it. */
    public function authorName(): string
    {
        return $this->is_anonymous ? 'A Cendol Satay reader' : (string) ($this->user?->name ?? 'A Cendol Satay reader');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('directory')
            ->logOnly(['status', 'moderation_note', 'is_verified_visit'])->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Review {$event}");
    }
}
