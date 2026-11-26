<?php

namespace App\Http\Resources\Directory;

use App\Models\Directory\Business;
use App\Models\Directory\BusinessClaim;
use App\Models\Directory\BusinessLocation;
use App\Models\Directory\Review;
use App\Models\Directory\Sector;
use App\Models\Media;
use App\Services\Directory\DetailSchema;
use App\Services\Directory\OpeningHours;
use Illuminate\Support\Str;

/**
 * Shapes for the directory, in one place so the public site, the owner pages and the admin agree.
 * Public shapes never include receipts, check-in coordinates, reporters or moderator notes.
 */
class Present
{
    public static function sector(Sector $s, bool $withFields = true): array
    {
        return [
            'slug' => $s->slug,
            'name' => $s->getTranslation('name', 'en'),
            'description' => $s->getTranslation('description', 'en', false) ?: null,
            'icon' => $s->icon,
            'color' => $s->color,
            'fields' => $withFields ? $s->fields() : null,
            'is_active' => $s->is_active,
            'position' => $s->position,
            'places_count' => $s->businesses_count ?? null,
        ];
    }

    public static function sectorRef(?Sector $s): ?array
    {
        return $s ? ['slug' => $s->slug, 'name' => $s->getTranslation('name', 'en'), 'color' => $s->color, 'icon' => $s->icon] : null;
    }

    /** One branch in a list or on the map card. */
    public static function card(BusinessLocation $l, ?float $lat = null, ?float $lng = null): array
    {
        $b = $l->business;
        $status = OpeningHours::status($l->hours, now());

        return [
            'id' => $l->ulid,
            'business_id' => $b->ulid,
            'slug' => $b->slug,
            'name' => $b->displayName(),
            'summary' => Str::limit(strip_tags((string) $b->getTranslation('description', 'en', false)), 140) ?: null,
            'sector' => self::sectorRef($b->sector),
            'area' => $l->area ? ['slug' => $l->area->slug, 'name' => $l->area->getTranslation('name', 'en')] : null,
            'branch_label' => $l->label,
            'branch_count' => $b->locations_count ?? null,
            'address' => $l->address,
            'latitude' => $l->latitude,
            'longitude' => $l->longitude,
            'rating_avg' => $b->rating_avg,
            'rating_count' => $b->rating_count,
            'is_claimed' => $b->is_claimed,
            'logo' => $b->logo?->toPublic(),
            'photo' => $b->photos->first()?->toPublic(),
            'open_now' => $status['open'],
            'hours_today' => $status['label'],
            'distance_m' => $lat !== null && $lng !== null ? $l->distanceTo($lat, $lng) : null,
        ];
    }

    /** Lightweight pin for the map. */
    public static function pin(BusinessLocation $l): array
    {
        $b = $l->business;

        return [
            'id' => $l->ulid,
            'slug' => $b->slug,
            'name' => $b->displayName(),
            'sector' => $b->sector?->slug,
            'color' => $b->sector?->color ?? 'marigold',
            'latitude' => $l->latitude,
            'longitude' => $l->longitude,
            'rating_avg' => $b->rating_avg,
        ];
    }

    public static function location(BusinessLocation $l, bool $withHoursRows = false): array
    {
        $status = OpeningHours::status($l->hours, now());

        return array_merge([
            'id' => $l->ulid,
            'label' => $l->label,
            'address' => $l->address,
            'postcode' => $l->postcode,
            'area' => $l->area ? ['slug' => $l->area->slug, 'name' => $l->area->getTranslation('name', 'en')] : null,
            'latitude' => $l->latitude,
            'longitude' => $l->longitude,
            'phone' => $l->phone,
            'hours_note' => $l->hours_note,
            'is_primary' => $l->is_primary,
            'open_now' => $status['open'],
            'hours_today' => $status['label'],
            'week' => OpeningHours::week($l->hours),
        ], $withHoursRows ? ['hours' => $l->hours->map(fn ($h) => ['day' => $h->day, 'opens' => $h->opens, 'closes' => $h->closes])->values()->all()] : []);
    }

    /** The full place page. */
    public static function detail(Business $b): array
    {
        $visible = $b->reviews()->visible();
        $breakdown = (clone $visible)->selectRaw('rating, COUNT(*) as n')->groupBy('rating')->pluck('n', 'rating');
        $subs = (clone $visible)->whereNotNull('sub_ratings')->pluck('sub_ratings');

        return [
            'id' => $b->ulid,
            'slug' => $b->slug,
            'name' => $b->displayName(),
            'description' => $b->getTranslation('description', 'en', false) ?: null,
            'sector' => self::sectorRef($b->sector),
            'details' => DetailSchema::present($b->sector, $b->details),
            'contacts' => (object) ($b->contacts ?? []),
            'rating_avg' => $b->rating_avg,
            'rating_count' => $b->rating_count,
            'rating_breakdown' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($n) => [$n => (int) ($breakdown[$n] ?? 0)]),
            'sub_ratings' => collect(Review::SUB_RATINGS)->mapWithKeys(fn ($k) => [$k => ($v = $subs->pluck($k)->filter()) ->isNotEmpty() ? round($v->avg(), 1) : null]),
            'is_claimed' => $b->is_claimed,
            'logo' => $b->logo?->toPublic(),
            'photos' => $b->photos->map(fn (Media $m) => $m->toPublic())->all(),
            'locations' => $b->locations->map(fn (BusinessLocation $l) => self::location($l))->all(),
            'reviews' => $b->reviews()->visible()->with(['user', 'photos', 'reply', 'location'])->latest('published_at')->limit(3)->get()
                ->map(fn (Review $r) => self::review($r))->all(),
            'updated_at' => $b->updated_at?->toIso8601String(),
        ];
    }

    /** A review as the public sees it. */
    public static function review(Review $r): array
    {
        return [
            'id' => $r->ulid,
            'rating' => $r->rating,
            'sub_ratings' => (object) ($r->sub_ratings ?? []),
            'title' => $r->title,
            'body' => $r->body,
            'visited_on' => $r->visited_on?->toDateString(),
            'author_name' => $r->authorName(),
            'is_verified_visit' => $r->is_verified_visit,
            'helpful_count' => $r->helpful_count,
            'branch_label' => $r->location?->label,
            'photos' => $r->photos->map(fn (Media $m) => $m->toPublic())->all(),
            'reply' => $r->reply ? ['body' => $r->reply->body, 'created_at' => $r->reply->created_at?->toIso8601String()] : null,
            'published_at' => $r->published_at?->toIso8601String(),
        ];
    }

    /** A review in the writer's own list, with its status and the moderator's reason if sent back. */
    public static function myReview(Review $r): array
    {
        return self::review($r) + [
            'status' => $r->status,
            'moderation_note' => in_array($r->status, [Review::RETURNED, Review::REMOVED], true) ? $r->moderation_note : null,
            'proof' => $r->proof?->kind,
            'place' => ['slug' => $r->business?->slug, 'name' => $r->business?->displayName(), 'sector' => $r->business?->sector?->slug],
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }

    /** Admin: a review with everything a moderator needs (except the receipt file itself, fetched separately). */
    public static function adminReview(Review $r, bool $full = false): array
    {
        $data = self::review($r) + [
            'status' => $r->status,
            'flags' => $r->flags ?? [],
            'is_anonymous' => $r->is_anonymous,
            'open_reports' => $r->open_reports,
            'moderation_note' => $r->moderation_note,
            'moderated_at' => $r->moderated_at?->toIso8601String(),
            'moderator' => $r->moderator ? ['id' => $r->moderator->id, 'name' => $r->moderator->name] : null,
            'writer' => $r->user ? ['id' => $r->user->id, 'name' => $r->user->name, 'email' => $r->user->email] : null,
            'place' => $r->business ? ['id' => $r->business->ulid, 'slug' => $r->business->slug, 'name' => $r->business->displayName(), 'sector' => $r->business->sector?->slug] : null,
            'proof' => $r->proof ? [
                'kind' => $r->proof->kind,
                'status' => $r->proof->status,
                'distance_m' => $r->proof->distance_m,
                'has_file' => (bool) $r->proof->path,
                'verified_at' => $r->proof->verified_at?->toIso8601String(),
            ] : null,
            'created_at' => $r->created_at?->toIso8601String(),
            'deleted_at' => $r->deleted_at?->toIso8601String(),
        ];
        if ($full) {
            $data['reports'] = $r->reports->map(fn ($rep) => [
                'id' => $rep->id,
                'reason' => $rep->reason,
                'reason_label' => Review::REPORT_REASONS[$rep->reason] ?? $rep->reason,
                'note' => $rep->note,
                'status' => $rep->status,
                'by' => $rep->user ? ['id' => $rep->user->id, 'name' => $rep->user->name] : null,
                'is_manager' => $r->business?->isManagedBy($rep->user),
                'created_at' => $rep->created_at?->toIso8601String(),
            ])->all();
        }

        return $data;
    }

    /** Admin and owner pages: the editable listing. */
    public static function business(Business $b, bool $full = false): array
    {
        $primary = $b->locations->first();
        $data = [
            'id' => $b->ulid,
            'slug' => $b->slug,
            'name' => $b->displayName(),
            'status' => $b->status,
            'sector' => self::sectorRef($b->sector),
            'area' => $primary?->area ? ['slug' => $primary->area->slug, 'name' => $primary->area->getTranslation('name', 'en')] : null,
            'address' => $primary?->address,
            'branch_count' => $b->locations->count(),
            'is_claimed' => $b->is_claimed,
            'rating_avg' => $b->rating_avg,
            'rating_count' => $b->rating_count,
            'logo' => $b->logo?->toPublic(),
            'created_by' => $b->creator ? ['id' => $b->creator->id, 'name' => $b->creator->name] : null,
            'created_at' => $b->created_at?->toIso8601String(),
            'updated_at' => $b->updated_at?->toIso8601String(),
            'deleted_at' => $b->deleted_at?->toIso8601String(),
        ];

        if ($full) {
            $data += [
                'description' => $b->getTranslation('description', 'en', false) ?: '',
                'ssm_number' => $b->ssm_number,
                'details' => (object) ($b->details ?? []),
                'contacts' => (object) ($b->contacts ?? []),
                'submitted_note' => $b->submitted_note,
                'moderation_note' => $b->moderation_note,
                'approved_at' => $b->approved_at?->toIso8601String(),
                'photos' => $b->photos->map(fn (Media $m) => $m->toPublic())->all(),
                'locations' => $b->locations->map(fn (BusinessLocation $l) => self::location($l, true))->all(),
                'members' => $b->members->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->pivot->role])->all(),
                'pending_claims' => $b->claims()->where('status', BusinessClaim::PENDING)->count(),
            ];
        }

        return $data;
    }

    public static function claim(BusinessClaim $c): array
    {
        return [
            'id' => $c->ulid,
            'status' => $c->status,
            'role' => $c->role,
            'ssm_number' => $c->ssm_number,
            'phone' => $c->phone,
            'note' => $c->note,
            'has_document' => (bool) $c->document_path,
            'decision_note' => $c->decision_note,
            'decided_at' => $c->decided_at?->toIso8601String(),
            'decided_by' => $c->decider ? ['id' => $c->decider->id, 'name' => $c->decider->name] : null,
            'user' => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name, 'email' => $c->user->email] : null,
            'place' => $c->business ? [
                'id' => $c->business->ulid, 'slug' => $c->business->slug, 'name' => $c->business->displayName(),
                'sector' => $c->business->sector?->slug, 'ssm_number' => $c->business->ssm_number, 'is_claimed' => $c->business->is_claimed,
            ] : null,
            'created_at' => $c->created_at?->toIso8601String(),
        ];
    }
}
