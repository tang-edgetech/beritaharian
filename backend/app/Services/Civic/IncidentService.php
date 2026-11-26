<?php

namespace App\Services\Civic;

use App\Exceptions\FriendlyException;
use App\Models\Area;
use App\Models\Civic\Incident;
use App\Models\Civic\IncidentType;
use App\Models\Civic\IncidentUpdate;
use App\Models\Media;
use App\Models\User;
use App\Notifications\IncidentUpdateNotification;
use App\Services\Billing\NumberSequence;
use App\Services\MediaService;
use App\Services\SettingService;
use App\Services\SiteCache;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The life of a civic report:
 *   new → (needs_info ⇄ reporter replies) → investigating → verified | unconfirmed | rejected → closed
 * Verified reports may be published as a public alert, written by staff. The reporter's own words,
 * name (if hidden) and files never reach the public site.
 */
class IncidentService
{
    public function __construct(
        private EvidenceStore $evidence,
        private NumberSequence $numbers,
        private SettingService $settings,
        private MediaService $media,
        private SiteCache $cache,
    ) {}

    /** @param  UploadedFile[]  $files */
    public function submit(User $reporter, array $data, array $files, Request $request): Incident
    {
        $perDay = (int) $this->settings->get('reports', 'reports_per_day', 5);
        if (Incident::withTrashed()->where('reporter_id', $reporter->id)->where('created_at', '>=', now()->subDay())->count() >= $perDay) {
            throw new FriendlyException('You have sent a lot of reports today. Please try again tomorrow, or call 999 if someone is in danger.', 'REPORT_LIMIT', 429);
        }
        $type = IncidentType::where('slug', $data['type'])->where('is_active', true)->first();
        if (! $type) {
            throw new FriendlyException('Please choose what kind of incident this is.', 'TYPE_NEEDED');
        }
        if (count($files) > $this->evidence->maxFiles()) {
            throw new FriendlyException("You can add up to {$this->evidence->maxFiles()} files.", 'TOO_MANY_FILES');
        }

        $lat = (float) $data['latitude'];
        $lng = (float) $data['longitude'];

        return DB::transaction(function () use ($reporter, $data, $files, $request, $type, $lat, $lng) {
            $prefix = (string) $this->settings->get('reports', 'reference_prefix', 'MLK');
            $incident = Incident::create([
                'reference_no' => $this->numbers->next('incident', $prefix, now()),
                'reporter_id' => $reporter->id,
                'incident_type_id' => $type->id,
                'area_id' => $this->areaFor($lat, $lng)?->id,
                'latitude' => $lat,
                'longitude' => $lng,
                'address' => $data['address'] ?? null,
                'occurred_at' => $data['occurred_at'],
                'title' => trim($data['title']),
                'description' => trim($data['description']),
                'is_anonymous_public' => (bool) ($data['is_anonymous'] ?? false),
                'status' => Incident::NEW,
                'severity' => $type->default_severity,
                'submitted_ip' => $request->ip(),
                'consented_at' => now(),
            ]);
            $names = [];
            foreach ($files as $file) {
                $names[] = $this->evidence->store($incident, $file, $reporter, 'reporter', $request)->original_name;
            }
            $this->log($incident, null, 'submitted', ['body' => 'Report received.', 'visible_to_reporter' => true, 'to_status' => Incident::NEW, 'meta' => $names ? ['files' => $names] : null]);

            return $incident;
        });
    }

    /** The reporter answers a question or adds more files while the report is still open. @param UploadedFile[] $files */
    public function reporterUpdate(Incident $incident, User $reporter, ?string $message, array $files, Request $request): void
    {
        $this->ensureReporter($incident, $reporter);
        if (! $incident->isOpen()) {
            throw new FriendlyException('This report is already decided, so it can’t take more replies. You can send a new report.', 'REPORT_DECIDED');
        }
        if (! trim((string) $message) && ! $files) {
            throw new FriendlyException('Please write a reply or add a file.', 'EMPTY_REPLY');
        }
        $total = $incident->evidences()->where('source', 'reporter')->count() + count($files);
        if ($total > $this->evidence->maxFiles() * 2) {
            throw new FriendlyException('This report already has as many files as we can take. Please describe the rest in your reply.', 'TOO_MANY_FILES');
        }

        DB::transaction(function () use ($incident, $reporter, $message, $files, $request) {
            $names = [];
            foreach ($files as $file) {
                $names[] = $this->evidence->store($incident, $file, $reporter, 'reporter', $request)->original_name;
            }
            $this->log($incident, $reporter, 'reply', [
                'body' => trim((string) $message) ?: null,
                'visible_to_reporter' => true,
                'meta' => $names ? ['files' => $names] : null,
            ]);
            $changes = ['reporter_replied_at' => now()];
            if ($incident->status === Incident::NEEDS_INFO) {
                // back into the "to check" queue
                $changes['status'] = Incident::NEW;
                $this->log($incident, $reporter, 'status', ['from_status' => Incident::NEEDS_INFO, 'to_status' => Incident::NEW, 'visible_to_reporter' => true]);
            }
            $incident->update($changes);
        });
    }

    /** The reporter takes back a report nobody has started on. The files are deleted at once. */
    public function withdraw(Incident $incident, User $reporter): void
    {
        $this->ensureReporter($incident, $reporter);
        if (! in_array($incident->status, [Incident::NEW, Incident::NEEDS_INFO], true)) {
            throw new FriendlyException('Our team is already looking into this report, so it can’t be withdrawn. Send them a reply instead.', 'CANNOT_WITHDRAW');
        }
        DB::transaction(function () use ($incident, $reporter) {
            $incident->evidences->each(fn ($e) => $this->evidence->purge($e));
            $this->changeStatus($incident, $reporter, Incident::WITHDRAWN, 'Withdrawn by the reporter.', notify: false);
        });
    }

    // ---- staff ----------------------------------------------------------

    public function assign(Incident $incident, User $actor, ?User $assignee): void
    {
        $incident->update(['assigned_to' => $assignee?->id]);
        $this->log($incident, $actor, 'assigned', ['body' => $assignee ? "Assigned to {$assignee->name}." : 'No longer assigned.']);
    }

    public function requestInfo(Incident $incident, User $actor, string $message): void
    {
        $this->ensureOpen($incident);
        DB::transaction(function () use ($incident, $actor, $message) {
            $this->log($incident, $actor, 'message', ['body' => trim($message), 'visible_to_reporter' => true]);
            $this->changeStatus($incident, $actor, Incident::NEEDS_INFO, notify: false);
            $incident->assigned_to ??= $actor->id;
            $incident->save();
        });
        $this->notify($incident, 'We need a little more information', $message);
    }

    public function investigate(Incident $incident, User $actor, ?string $note = null): void
    {
        if (! in_array($incident->status, [Incident::NEW, Incident::NEEDS_INFO], true)) {
            throw new FriendlyException('Only new reports or reports waiting for the reporter can be moved to "Checking".', 'WRONG_STATUS');
        }
        DB::transaction(function () use ($incident, $actor, $note) {
            if ($note) {
                $this->log($incident, $actor, 'note', ['body' => trim($note)]);
            }
            $incident->assigned_to ??= $actor->id;
            $this->changeStatus($incident, $actor, Incident::INVESTIGATING, notify: false);
        });
    }

    /**
     * Confirmed. With publish_alert the staff-written alert goes on the public site at once.
     * @param  array{severity?: string, checklist?: array, publish_alert?: bool, public_title?: ?string, public_summary?: ?string, public_address?: ?string, note?: ?string}  $data
     */
    public function verify(Incident $incident, User $actor, array $data): void
    {
        $this->ensureOpen($incident);
        $this->ensureNotOwn($incident, $actor);
        $publish = (bool) ($data['publish_alert'] ?? false);
        if ($publish && (! trim((string) ($data['public_title'] ?? '')) || ! trim((string) ($data['public_summary'] ?? '')))) {
            throw new FriendlyException('Please write the alert title and summary before publishing.', 'ALERT_TEXT_NEEDED');
        }

        DB::transaction(function () use ($incident, $actor, $data, $publish) {
            $incident->fill([
                'severity' => $data['severity'] ?? $incident->severity,
                'checklist' => $this->checklist($data['checklist'] ?? []),
                'public_title' => $data['public_title'] ?? $incident->public_title,
                'public_summary' => $data['public_summary'] ?? $incident->public_summary,
                'public_address' => $data['public_address'] ?? $incident->public_address,
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'decision_note' => null,
                'alert_published_at' => $publish ? now() : null,
            ]);
            if ($data['note'] ?? null) {
                $this->log($incident, $actor, 'note', ['body' => trim($data['note'])]);
            }
            $this->changeStatus($incident, $actor, Incident::VERIFIED, notify: false);
            if ($publish) {
                $this->log($incident, $actor, 'alert', ['body' => 'Published as a public alert.', 'visible_to_reporter' => true]);
            }
        });

        $this->notify($incident, $publish ? 'Your report was confirmed and is now a public alert' : 'Your report was confirmed');
        $this->refreshAlerts($incident);
    }

    /** Could not be confirmed. Kept private; the reporter is told why. */
    public function unconfirm(Incident $incident, User $actor, string $reason, array $checklist = []): void
    {
        $this->ensureOpen($incident);
        $this->ensureNotOwn($incident, $actor);
        DB::transaction(function () use ($incident, $actor, $reason, $checklist) {
            $incident->fill(['checklist' => $this->checklist($checklist), 'decision_note' => trim($reason), 'decided_by' => $actor->id, 'decided_at' => now(), 'alert_published_at' => null]);
            $this->changeStatus($incident, $actor, Incident::UNCONFIRMED, trim($reason), notify: false);
        });
        $this->notify($incident, 'We could not confirm your report', $reason);
    }

    /** Spam, a duplicate, or not something we cover. The reporter is told why in plain words. */
    public function reject(Incident $incident, User $actor, string $reason, ?string $duplicateOf = null): void
    {
        $this->ensureOpen($incident);
        $duplicate = null;
        if ($duplicateOf) {
            $duplicate = Incident::where('reference_no', $duplicateOf)->first();
            if (! $duplicate || $duplicate->is($incident)) {
                throw new FriendlyException('We couldn’t find that report number. Please check it and try again.', 'DUPLICATE_NOT_FOUND');
            }
        }
        DB::transaction(function () use ($incident, $actor, $reason, $duplicate) {
            $incident->fill(['duplicate_of_id' => $duplicate?->id, 'decision_note' => trim($reason), 'decided_by' => $actor->id, 'decided_at' => now(), 'alert_published_at' => null]);
            $this->changeStatus($incident, $actor, Incident::REJECTED, trim($reason), notify: false);
        });
        $this->notify($incident, 'Your report was closed', $reason);
    }

    /** Finished: for an alert this marks it "Resolved" on the site. */
    public function close(Incident $incident, User $actor, ?string $note = null): void
    {
        if (! in_array($incident->status, [Incident::VERIFIED, Incident::UNCONFIRMED], true)) {
            throw new FriendlyException('Only confirmed or unconfirmed reports can be closed. Reject the report instead.', 'WRONG_STATUS');
        }
        $wasAlert = $incident->isAlert();
        DB::transaction(function () use ($incident, $actor, $note, $wasAlert) {
            if ($wasAlert) {
                $incident->resolved_at = now();
            }
            $this->changeStatus($incident, $actor, Incident::CLOSED, $note ? trim($note) : ($wasAlert ? 'The alert is marked as resolved.' : null), notify: false);
        });
        if ($wasAlert) {
            $this->notify($incident, 'The alert from your report is now marked as resolved', $note);
            $this->refreshAlerts($incident);
        }
    }

    /** Look at a decided report again. A published alert comes down until it is verified again. */
    public function reopen(Incident $incident, User $actor, string $note): void
    {
        if ($incident->isOpen() || $incident->status === Incident::WITHDRAWN) {
            throw new FriendlyException('This report is still open.', 'WRONG_STATUS');
        }
        $wasAlert = $incident->isAlert();
        DB::transaction(function () use ($incident, $actor, $note) {
            $incident->fill(['alert_published_at' => null, 'resolved_at' => null, 'decided_by' => null, 'decided_at' => null, 'decision_note' => null, 'duplicate_of_id' => null]);
            $this->log($incident, $actor, 'note', ['body' => trim($note)]);
            $this->changeStatus($incident, $actor, Incident::INVESTIGATING, notify: false);
        });
        if ($wasAlert) {
            $this->refreshAlerts($incident);
        }
    }

    /** Edit the public alert text, publish it, or take it down. */
    public function updateAlert(Incident $incident, User $actor, array $data): void
    {
        if (! in_array($incident->status, [Incident::VERIFIED, Incident::CLOSED], true)) {
            throw new FriendlyException('Only confirmed reports can have a public alert.', 'NOT_VERIFIED');
        }
        $incident->fill(array_intersect_key($data, array_flip(['public_title', 'public_summary', 'public_address', 'severity'])));
        $publish = $data['published'] ?? null;
        if ($publish === true && ! $incident->alert_published_at) {
            if (! trim((string) $incident->public_title) || ! trim((string) $incident->public_summary)) {
                throw new FriendlyException('Please write the alert title and summary before publishing.', 'ALERT_TEXT_NEEDED');
            }
            $incident->alert_published_at = now();
            $this->log($incident, $actor, 'alert', ['body' => 'Published as a public alert.', 'visible_to_reporter' => true]);
        } elseif ($publish === false && $incident->alert_published_at) {
            $incident->alert_published_at = null;
            $this->log($incident, $actor, 'alert', ['body' => 'Public alert taken down.']);
        } elseif ($incident->isDirty(['public_title', 'public_summary', 'public_address', 'severity'])) {
            $this->log($incident, $actor, 'alert', ['body' => 'Public alert edited.']);
        }
        $incident->save();
        $this->refreshAlerts($incident);
    }

    /** An internal note, or (to_reporter) a message the reporter sees and gets by email. */
    public function note(Incident $incident, User $actor, string $body, bool $toReporter): void
    {
        $this->log($incident, $actor, $toReporter ? 'message' : 'note', ['body' => trim($body), 'visible_to_reporter' => $toReporter]);
        if ($toReporter) {
            $this->notify($incident, 'New message about your report', $body);
        }
    }

    /** Files staff collect themselves (site visit, CCTV from a shop). @param UploadedFile[] $files */
    public function staffEvidence(Incident $incident, User $actor, array $files, Request $request): void
    {
        $names = [];
        foreach ($files as $file) {
            $names[] = $this->evidence->store($incident, $file, $actor, 'staff', $request)->original_name;
        }
        $this->log($incident, $actor, 'evidence', ['body' => count($names) === 1 ? 'Added 1 file.' : 'Added '.count($names).' files.', 'meta' => ['files' => $names]]);
    }

    /** A blurred copy for the public alert. MediaService re-encodes it, which also strips camera data. */
    public function addPublicPhoto(Incident $incident, User $actor, UploadedFile $file, ?string $alt): Media
    {
        $media = $this->media->storeImage($file, 'incident', $actor, ['alt' => $alt ?: ($incident->public_title ?: 'Photo from the incident')]);
        $media->forceFill([
            'mediable_type' => $incident->getMorphClass(),
            'mediable_id' => $incident->id,
            'position' => (int) $incident->publicPhotos()->max('position') + 1,
        ])->save();
        $this->log($incident, $actor, 'alert', ['body' => 'Added a public photo.']);
        $this->refreshAlerts($incident);

        return $media;
    }

    public function removePublicPhoto(Incident $incident, User $actor, Media $media): void
    {
        if ($media->mediable_id !== $incident->id || $media->mediable_type !== $incident->getMorphClass()) {
            throw new FriendlyException('That photo is not part of this alert.', 'NOT_FOUND', 404);
        }
        $media->delete();
        $this->log($incident, $actor, 'alert', ['body' => 'Removed a public photo.']);
        $this->refreshAlerts($incident);
    }

    /** @param  string[]  $ids  media ulids in the new order */
    public function reorderPublicPhotos(Incident $incident, array $ids): void
    {
        foreach ($incident->publicPhotos as $media) {
            $position = array_search($media->ulid, $ids, true);
            $media->forceFill(['position' => $position === false ? 999 : $position])->save();
        }
        $this->refreshAlerts($incident);
    }

    /** Other reports close by in place and time, to spot duplicates and second sources. */
    public function nearby(Incident $incident): Collection
    {
        $radius = (int) $this->settings->get('reports', 'nearby_radius_m', 500);
        $dLat = $radius / 111_000;
        $dLng = $dLat / max(cos(deg2rad($incident->latitude)), 0.01);

        return Incident::with('type')
            ->whereKeyNot($incident->id)
            ->whereBetween('latitude', [$incident->latitude - $dLat, $incident->latitude + $dLat])
            ->whereBetween('longitude', [$incident->longitude - $dLng, $incident->longitude + $dLng])
            ->whereBetween('occurred_at', [$incident->occurred_at->copy()->subDays(3), $incident->occurred_at->copy()->addDays(3)])
            ->latest('occurred_at')->limit(20)->get()
            ->map(function (Incident $other) use ($incident) {
                $other->distance_m = self::distance($incident->latitude, $incident->longitude, $other->latitude, $other->longitude);

                return $other;
            })
            ->filter(fn (Incident $other) => $other->distance_m <= $radius)
            ->sortBy('distance_m')->values();
    }

    /**
     * Daily: files from rejected and withdrawn reports are deleted after the retention period
     * (Settings › Reports), unless they were handed to the police. Names and hashes stay as a record.
     */
    public function purgeExpiredEvidence(): int
    {
        $days = (int) $this->settings->get('reports', 'purge_rejected_days', 180);
        $count = 0;
        Incident::withTrashed()
            ->whereIn('status', [Incident::REJECTED, Incident::WITHDRAWN])
            ->where('updated_at', '<=', now()->subDays($days))
            ->whereDoesntHave('handovers')
            ->whereHas('evidences', fn ($q) => $q->whereNotNull('disk_path'))
            ->each(function (Incident $incident) use (&$count) {
                $incident->evidences()->whereNotNull('disk_path')->get()->each(function ($e) use (&$count) {
                    $this->evidence->purge($e);
                    $count++;
                });
            });

        return $count;
    }

    public function areaFor(float $lat, float $lng): ?Area
    {
        $areas = Area::whereNotNull('latitude')->whereNotNull('longitude')->get();
        $nearest = fn (Collection $list) => $list->sortBy(fn (Area $a) => self::distance($lat, $lng, $a->latitude, $a->longitude))->first();
        $locality = $nearest($areas->where('type', Area::LOCALITY));
        if ($locality && self::distance($lat, $lng, $locality->latitude, $locality->longitude) <= 4000) {
            return $locality;
        }

        return $nearest($areas->where('type', Area::DISTRICT));
    }

    public static function distance(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $x = deg2rad($lng2 - $lng1) * cos(deg2rad(($lat1 + $lat2) / 2));
        $y = deg2rad($lat2 - $lat1);

        return (int) round(sqrt($x * $x + $y * $y) * 6_371_000);
    }

    // ---- helpers --------------------------------------------------------

    private function changeStatus(Incident $incident, ?User $actor, string $to, ?string $body = null, bool $notify = true): void
    {
        $from = $incident->status;
        $incident->status = $to;
        $incident->save();
        $this->log($incident, $actor, 'status', ['from_status' => $from, 'to_status' => $to, 'body' => $body, 'visible_to_reporter' => true]);
    }

    private function log(Incident $incident, ?User $user, string $kind, array $data = []): IncidentUpdate
    {
        return $incident->updates()->create(array_merge(['user_id' => $user?->id, 'kind' => $kind], $data));
    }

    private function notify(Incident $incident, string $headline, ?string $body = null): void
    {
        $incident->reporter?->notify(new IncidentUpdateNotification($incident, $headline, $body ? trim($body) : null));
    }

    private function refreshAlerts(Incident $incident): void
    {
        $this->cache->refresh(['alerts', 'alert-'.$incident->reference_no]);
    }

    private function checklist(array $ticked): array
    {
        return collect(Incident::CHECKLIST)->keys()->mapWithKeys(fn ($key) => [$key => (bool) ($ticked[$key] ?? false)])->all();
    }

    private function ensureOpen(Incident $incident): void
    {
        if (! $incident->isOpen()) {
            throw new FriendlyException('This report has already been decided. Reopen it first.', 'REPORT_DECIDED');
        }
    }

    /** Nobody verifies their own report. */
    private function ensureNotOwn(Incident $incident, User $actor): void
    {
        if ($incident->reporter_id === $actor->id) {
            throw new FriendlyException('You sent this report yourself, so another verifier has to decide it.', 'OWN_REPORT', 403);
        }
    }

    private function ensureReporter(Incident $incident, User $user): void
    {
        if ($incident->reporter_id !== $user->id) {
            throw new FriendlyException('This report belongs to someone else.', 'NOT_YOURS', 403);
        }
    }
}
