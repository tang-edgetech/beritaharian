<?php

namespace App\Models\News;

use App\Models\Area;
use App\Models\Media;
use App\Models\Tag;
use App\Models\User;
use App\Services\SiteCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Translatable\HasTranslations;

/**
 * A news story. Moves draft → in review → verified → published (or scheduled), and can be archived.
 * Breaking news may go straight to published with the "developing" label until a verifier signs it off.
 */
class Article extends Model
{
    use HasTranslations, HasUlids, LogsActivity, SoftDeletes;

    public const DRAFT = 'draft';

    public const IN_REVIEW = 'in_review';

    public const VERIFIED = 'verified';

    public const SCHEDULED = 'scheduled';

    public const PUBLISHED = 'published';

    public const ARCHIVED = 'archived';

    public const STATUSES = [self::DRAFT, self::IN_REVIEW, self::VERIFIED, self::SCHEDULED, self::PUBLISHED, self::ARCHIVED];

    public const LABEL_VERIFIED = 'verified';

    public const LABEL_DEVELOPING = 'developing';

    public const LABEL_CORRECTED = 'corrected';

    public array $translatable = ['title', 'excerpt', 'body'];

    protected $fillable = ['author_id', 'category_id', 'area_id', 'title', 'slug', 'excerpt', 'body', 'is_breaking', 'is_featured'];

    protected function casts(): array
    {
        return [
            'is_breaking' => 'boolean',
            'is_featured' => 'boolean',
            'verified_at' => 'datetime',
            'published_at' => 'datetime',
            'corrected_at' => 'datetime',
            'view_count' => 'integer',
            'reading_minutes' => 'integer',
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

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')->withTrashed();
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function tags(): MorphToMany
    {
        return $this->morphToMany(Tag::class, 'taggable')->orderBy('name');
    }

    public function cover(): MorphOne
    {
        return $this->morphOne(Media::class, 'mediable')->where('collection', 'cover');
    }

    public function sources(): HasMany
    {
        return $this->hasMany(ArticleSource::class)->orderBy('position');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(ArticleRevision::class)->latest('id');
    }

    public function corrections(): HasMany
    {
        return $this->hasMany(ArticleRevision::class)->where('is_public_correction', true)->latest('id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    /** Readers can see it: published, or scheduled and the time has come. */
    public function scopeLive(Builder $query): Builder
    {
        return $query->whereIn('status', [self::PUBLISHED, self::SCHEDULED])->where('published_at', '<=', now());
    }

    public function isLive(): bool
    {
        return in_array($this->status, [self::PUBLISHED, self::SCHEDULED], true) && $this->published_at?->lte(now());
    }

    /** Is the author allowed to keep changing it without an editor? */
    public function isEditableByAuthor(): bool
    {
        return $this->status === self::DRAFT;
    }

    protected static function booted(): void
    {
        // readers see publishing, corrections and take-downs straight away
        $refresh = function (Article $article) {
            if ($article->isLive() || $article->wasChanged('status') || $article->trashed()) {
                app(SiteCache::class)->refresh(['news', 'article-'.$article->slug]);
            }
        };
        static::saved($refresh);
        static::deleted($refresh);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('news')
            ->logOnly(['status', 'truth_label', 'is_breaking', 'is_featured', 'category_id', 'published_at', 'archived_reason'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => 'Article “'.str($this->getTranslation('title', 'en', false))->limit(60)."” {$event}");
    }
}
