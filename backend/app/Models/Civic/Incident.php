<?php

namespace App\Models\Civic;

use App\Models\Area;
use App\Models\Media;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * An incident a reader reported. The reporter's own words and files stay private; the public
 * only sees an alert that staff write after verifying (public_title, public_summary, blurred photos).
 */
class Incident extends Model
{
    use HasUlids, LogsActivity, SoftDeletes;

    public const NEW = 'new';

    public const NEEDS_INFO = 'needs_info';

    public const INVESTIGATING = 'investigating';

    public const VERIFIED = 'verified';

    public const UNCONFIRMED = 'unconfirmed';

    public const REJECTED = 'rejected';

    public const CLOSED = 'closed';

    public const WITHDRAWN = 'withdrawn';

    public const STATUSES = [self::NEW, self::NEEDS_INFO, self::INVESTIGATING, self::VERIFIED, self::UNCONFIRMED, self::REJECTED, self::CLOSED, self::WITHDRAWN];

    /** Still waiting for staff to decide. */
    public const OPEN = [self::NEW, self::NEEDS_INFO, self::INVESTIGATING];

    public const SEVERITIES = ['low', 'medium', 'high', 'critical'];

    /** What a verifier ticks before deciding. */
    public const CHECKLIST = [
        'location_matches' => 'Photos or videos match the place',
        'time_plausible' => 'The time fits (camera time, weather, light)',
        'not_reused' => 'Files are not old or copied from elsewhere',
        'second_source' => 'Confirmed by another report, source or site visit',
        'no_accusation' => 'Public alert describes the event, not who is to blame',
        'faces_blurred' => 'Faces and number plates are blurred in public photos',
    ];

    protected $fillable = [
        'reference_no', 'reporter_id', 'incident_type_id', 'area_id', 'latitude', 'longitude', 'address', 'occurred_at',
        'title', 'description', 'is_anonymous_public', 'status', 'severity', 'assigned_to', 'duplicate_of_id', 'checklist',
        'decision_note', 'decided_by', 'decided_at', 'public_title', 'public_summary', 'public_address',
        'alert_published_at', 'resolved_at', 'submitted_ip', 'consented_at', 'reporter_replied_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'occurred_at' => 'datetime',
            'is_anonymous_public' => 'boolean',
            'checklist' => 'array',
            'decided_at' => 'datetime',
            'alert_published_at' => 'datetime',
            'resolved_at' => 'datetime',
            'consented_at' => 'datetime',
            'reporter_replied_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'reference_no';
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id')->withTrashed();
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(IncidentType::class, 'incident_type_id');
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withTrashed();
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by')->withTrashed();
    }

    public function duplicateOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'duplicate_of_id')->withTrashed();
    }

    public function evidences(): HasMany
    {
        return $this->hasMany(IncidentEvidence::class)->orderBy('id');
    }

    public function updates(): HasMany
    {
        return $this->hasMany(IncidentUpdate::class)->orderBy('created_at')->orderBy('id');
    }

    public function handovers(): HasMany
    {
        return $this->hasMany(EvidenceHandover::class)->latest('id');
    }

    /** Blurred copies uploaded by staff for the public alert. */
    public function publicPhotos(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable')->where('collection', 'incident')->orderBy('position');
    }

    /** Alerts the public can see: verified (active) or closed after being verified (resolved). */
    public function scopeAlerts(Builder $query): Builder
    {
        return $query->whereNotNull('alert_published_at')->whereIn('status', [self::VERIFIED, self::CLOSED]);
    }

    public function isAlert(): bool
    {
        return $this->alert_published_at !== null && in_array($this->status, [self::VERIFIED, self::CLOSED], true);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN, true);
    }

    public function reporterPublicName(): string
    {
        return $this->is_anonymous_public ? 'A Cendol Satay reader' : (string) ($this->reporter?->name ?? 'A Cendol Satay reader');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('civic')
            ->logOnly(['status', 'severity', 'assigned_to', 'incident_type_id', 'decision_note', 'public_title', 'public_summary', 'public_address', 'alert_published_at', 'resolved_at', 'duplicate_of_id'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Incident {$event}");
    }
}
