<?php

namespace App\Http\Resources\Civic;

use App\Models\Civic\EvidenceHandover;
use App\Models\Civic\Incident;
use App\Models\Civic\IncidentEvidence;
use App\Models\Civic\IncidentType;
use App\Models\Civic\IncidentUpdate;
use App\Models\Media;
use Illuminate\Support\Str;

/**
 * Shapes for civic reports. Three audiences, three levels of detail:
 *  - public alerts: only what staff wrote and the blurred photos; never the reporter's text, files or contact details
 *  - the reporter: their own report, their files (no download) and the messages meant for them
 *  - staff: everything, including hashes, camera data and the internal notes
 */
class IncidentPresent
{
    /** Words the reporter sees. */
    public const REPORTER_STATUS = [
        Incident::NEW => 'Received',
        Incident::NEEDS_INFO => 'We need more information',
        Incident::INVESTIGATING => 'Being checked',
        Incident::VERIFIED => 'Confirmed',
        Incident::UNCONFIRMED => 'Could not be confirmed',
        Incident::REJECTED => 'Closed',
        Incident::CLOSED => 'Closed',
        Incident::WITHDRAWN => 'Withdrawn',
    ];

    /** Words staff see. */
    public const STAFF_STATUS = [
        Incident::NEW => 'New',
        Incident::NEEDS_INFO => 'Waiting for reporter',
        Incident::INVESTIGATING => 'Checking',
        Incident::VERIFIED => 'Verified',
        Incident::UNCONFIRMED => 'Unconfirmed',
        Incident::REJECTED => 'Rejected',
        Incident::CLOSED => 'Closed',
        Incident::WITHDRAWN => 'Withdrawn',
    ];

    public static function type(IncidentType $t, bool $admin = false): array
    {
        $data = [
            'slug' => $t->slug,
            'name' => $t->getTranslation('name', 'en'),
            'description' => $t->getTranslation('description', 'en', false) ?: null,
            'icon' => $t->icon,
            'color' => $t->color,
        ];
        if ($admin) {
            $data += [
                'default_severity' => $t->default_severity,
                'is_active' => $t->is_active,
                'position' => $t->position,
                'incidents_count' => $t->incidents_count ?? null,
            ];
        }

        return $data;
    }

    public static function typeRef(?IncidentType $t): ?array
    {
        return $t ? ['slug' => $t->slug, 'name' => $t->getTranslation('name', 'en'), 'icon' => $t->icon, 'color' => $t->color] : null;
    }

    private static function area(Incident $i): ?array
    {
        return $i->area ? ['slug' => $i->area->slug, 'name' => $i->area->getTranslation('name', 'en')] : null;
    }

    // ---- public ---------------------------------------------------------

    /** An alert in a list or on a map card. */
    public static function alert(Incident $i, ?float $lat = null, ?float $lng = null): array
    {
        $cover = $i->publicPhotos->first();

        return [
            'ref' => $i->reference_no,
            'title' => $i->public_title,
            'summary' => Str::limit((string) $i->public_summary, 180),
            'type' => self::typeRef($i->type),
            'severity' => $i->severity,
            'state' => $i->status === Incident::CLOSED ? 'resolved' : 'active',
            'area' => self::area($i),
            'place' => $i->public_address,
            'latitude' => $i->latitude,
            'longitude' => $i->longitude,
            'distance_m' => $lat !== null && $lng !== null ? \App\Services\Civic\IncidentService::distance($lat, $lng, $i->latitude, $i->longitude) : null,
            'cover' => $cover?->toPublic(),
            'occurred_at' => $i->occurred_at?->toIso8601String(),
            'published_at' => $i->alert_published_at?->toIso8601String(),
            'resolved_at' => $i->resolved_at?->toIso8601String(),
            'updated_at' => $i->updated_at?->toIso8601String(),
        ];
    }

    public static function alertPin(Incident $i): array
    {
        return [
            'ref' => $i->reference_no,
            'title' => $i->public_title,
            'type' => $i->type?->slug,
            'color' => $i->type?->color,
            'icon' => $i->type?->icon,
            'severity' => $i->severity,
            'state' => $i->status === Incident::CLOSED ? 'resolved' : 'active',
            'latitude' => $i->latitude,
            'longitude' => $i->longitude,
        ];
    }

    public static function alertDetail(Incident $i): array
    {
        return array_merge(self::alert($i), [
            'summary' => $i->public_summary,
            'photos' => $i->publicPhotos->map(fn (Media $m) => $m->toPublic())->all(),
            'reported_by' => $i->reporterPublicName(),
        ]);
    }

    // ---- the reporter ---------------------------------------------------

    public static function mine(Incident $i): array
    {
        return [
            'ref' => $i->reference_no,
            'title' => $i->title,
            'type' => self::typeRef($i->type),
            'area' => self::area($i),
            'status' => $i->status,
            'status_label' => self::REPORTER_STATUS[$i->status] ?? $i->status,
            'needs_reply' => $i->status === Incident::NEEDS_INFO,
            'is_alert' => $i->isAlert(),
            'occurred_at' => $i->occurred_at?->toIso8601String(),
            'created_at' => $i->created_at?->toIso8601String(),
            'updated_at' => $i->updated_at?->toIso8601String(),
        ];
    }

    public static function mineDetail(Incident $i): array
    {
        return array_merge(self::mine($i), [
            'description' => $i->description,
            'address' => $i->address,
            'latitude' => $i->latitude,
            'longitude' => $i->longitude,
            'is_anonymous' => $i->is_anonymous_public,
            'decision_note' => in_array($i->status, [Incident::REJECTED, Incident::UNCONFIRMED], true) ? $i->decision_note : null,
            'duplicate_of' => $i->duplicateOf?->isAlert() ? $i->duplicateOf->reference_no : null,
            'can_reply' => $i->isOpen(),
            'can_withdraw' => in_array($i->status, [Incident::NEW, Incident::NEEDS_INFO], true),
            'files' => $i->evidences->where('source', 'reporter')->map(fn (IncidentEvidence $e) => [
                'id' => $e->ulid,
                'name' => $e->original_name,
                'kind' => $e->kind,
                'size' => $e->size,
                'received_at' => $e->created_at?->toIso8601String(),
                'kept' => $e->disk_path !== null,
            ])->values()->all(),
            'timeline' => $i->updates->where('visible_to_reporter', true)->map(fn (IncidentUpdate $u) => [
                'id' => $u->id,
                'kind' => $u->kind,
                'from' => $u->user_id === $i->reporter_id ? 'you' : ($u->user_id ? 'team' : 'system'),
                'status' => $u->kind === 'status' ? (self::REPORTER_STATUS[$u->to_status] ?? $u->to_status) : null,
                'body' => $u->body,
                'files' => $u->meta['files'] ?? [],
                'at' => $u->created_at?->toIso8601String(),
            ])->values()->all(),
        ]);
    }

    // ---- staff ----------------------------------------------------------

    public static function admin(Incident $i): array
    {
        return [
            'id' => $i->ulid,
            'ref' => $i->reference_no,
            'title' => $i->title,
            'type' => self::typeRef($i->type),
            'area' => self::area($i),
            'status' => $i->status,
            'status_label' => self::STAFF_STATUS[$i->status] ?? $i->status,
            'severity' => $i->severity,
            'latitude' => $i->latitude,
            'longitude' => $i->longitude,
            'address' => $i->address,
            'reporter' => $i->reporter ? ['id' => $i->reporter->id, 'name' => $i->reporter->name] : null,
            'is_anonymous' => $i->is_anonymous_public,
            'assignee' => $i->assignee ? ['id' => $i->assignee->id, 'name' => $i->assignee->name] : null,
            'evidence_count' => $i->evidences_count ?? $i->evidences->count(),
            'is_alert' => $i->isAlert(),
            'reporter_replied' => $i->reporter_replied_at !== null && $i->status === Incident::NEW,
            'occurred_at' => $i->occurred_at?->toIso8601String(),
            'created_at' => $i->created_at?->toIso8601String(),
            'updated_at' => $i->updated_at?->toIso8601String(),
        ];
    }

    public static function adminDetail(Incident $i, array $nearby = []): array
    {
        return array_merge(self::admin($i), [
            'description' => $i->description,
            'reporter' => $i->reporter ? [
                'id' => $i->reporter->id,
                'name' => $i->reporter->name,
                'email' => $i->reporter->email,
                'phone' => $i->reporter->phone,
                'reports_count' => Incident::withTrashed()->where('reporter_id', $i->reporter_id)->count(),
                'confirmed_count' => Incident::withTrashed()->where('reporter_id', $i->reporter_id)->whereIn('status', [Incident::VERIFIED, Incident::CLOSED])->count(),
            ] : null,
            'checklist' => $i->checklist ?? (object) [],
            'checklist_items' => collect(Incident::CHECKLIST)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'decision_note' => $i->decision_note,
            'decided_by' => $i->decider ? ['id' => $i->decider->id, 'name' => $i->decider->name] : null,
            'decided_at' => $i->decided_at?->toIso8601String(),
            'duplicate_of' => $i->duplicateOf?->reference_no,
            'submitted_ip' => $i->submitted_ip,
            'consented_at' => $i->consented_at?->toIso8601String(),
            'alert' => [
                'title' => $i->public_title,
                'summary' => $i->public_summary,
                'place' => $i->public_address,
                'published_at' => $i->alert_published_at?->toIso8601String(),
                'resolved_at' => $i->resolved_at?->toIso8601String(),
                'photos' => $i->publicPhotos->map(fn (Media $m) => $m->toPublic())->all(),
            ],
            'evidence' => $i->evidences->map(fn (IncidentEvidence $e) => self::evidence($e))->all(),
            'timeline' => $i->updates->map(fn (IncidentUpdate $u) => self::update($u, $i))->all(),
            'handovers' => $i->handovers->map(fn (EvidenceHandover $h) => self::handover($h))->all(),
            'nearby' => array_map(fn (Incident $n) => [
                'ref' => $n->reference_no,
                'title' => $n->title,
                'type' => self::typeRef($n->type),
                'status' => $n->status,
                'status_label' => self::STAFF_STATUS[$n->status] ?? $n->status,
                'distance_m' => $n->distance_m,
                'latitude' => $n->latitude,
                'longitude' => $n->longitude,
                'occurred_at' => $n->occurred_at?->toIso8601String(),
            ], $nearby),
            'deleted_at' => $i->deleted_at?->toIso8601String(),
        ]);
    }

    public static function evidence(IncidentEvidence $e): array
    {
        return [
            'id' => $e->ulid,
            'kind' => $e->kind,
            'name' => $e->original_name,
            'mime' => $e->mime,
            'size' => $e->size,
            'sha256' => $e->sha256,
            'exif' => $e->exif ?? (object) [],
            'captured_at' => $e->captured_at?->toIso8601String(),
            'source' => $e->source,
            'uploader' => $e->uploader ? ['id' => $e->uploader->id, 'name' => $e->uploader->name] : null,
            'uploader_ip' => $e->uploader_ip,
            'received_at' => $e->created_at?->toIso8601String(),
            'kept' => $e->disk_path !== null,
            'purged_at' => $e->purged_at?->toIso8601String(),
        ];
    }

    public static function update(IncidentUpdate $u, Incident $i): array
    {
        return [
            'id' => $u->id,
            'kind' => $u->kind,
            'by' => $u->user ? ['id' => $u->user->id, 'name' => $u->user->name, 'is_reporter' => $u->user_id === $i->reporter_id] : null,
            'from_status' => $u->from_status,
            'to_status' => $u->to_status,
            'to_label' => $u->to_status ? (self::STAFF_STATUS[$u->to_status] ?? $u->to_status) : null,
            'body' => $u->body,
            'visible_to_reporter' => $u->visible_to_reporter,
            'files' => $u->meta['files'] ?? [],
            'at' => $u->created_at?->toIso8601String(),
        ];
    }

    public static function handover(EvidenceHandover $h): array
    {
        return [
            'id' => $h->ulid,
            'agency' => $h->agency,
            'officer_name' => $h->officer_name,
            'officer_id' => $h->officer_id,
            'police_report_no' => $h->police_report_no,
            'notes' => $h->notes,
            'files' => count($h->evidence_ids ?? []),
            'pack_size' => $h->pack_size,
            'manifest_sha256' => $h->manifest_sha256,
            'pack_sha256' => $h->pack_sha256,
            'has_pack' => (bool) $h->pack_path,
            'exported_by' => $h->exporter ? ['id' => $h->exporter->id, 'name' => $h->exporter->name] : null,
            'created_at' => $h->created_at?->toIso8601String(),
        ];
    }
}
