<?php

namespace App\Http\Controllers\Api\Admin\Civic;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Civic\IncidentPresent;
use App\Models\Area;
use App\Models\Civic\Incident;
use App\Models\Civic\IncidentEvidence;
use App\Models\Media;
use App\Models\User;
use App\Services\Civic\EvidenceStore;
use App\Services\Civic\IncidentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The verifier's queue: check incident reports, talk to the reporter, decide, and publish alerts. */
class IncidentController extends Controller
{
    private const DETAIL = ['type', 'area', 'reporter', 'assignee', 'decider', 'duplicateOf', 'evidences.uploader', 'updates.user', 'handovers.exporter', 'publicPhotos'];

    public function __construct(private IncidentService $incidents, private EvidenceStore $evidence) {}

    /** GET /admin/incidents/summary: counts for the sidebar and queue tabs. */
    public function summary(Request $request): JsonResponse
    {
        $counts = Incident::selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return response()->json(['data' => [
            'to_check' => (int) ($counts[Incident::NEW] ?? 0),
            'waiting' => (int) ($counts[Incident::NEEDS_INFO] ?? 0),
            'checking' => (int) ($counts[Incident::INVESTIGATING] ?? 0),
            'mine' => Incident::whereIn('status', Incident::OPEN)->where('assigned_to', $request->user()->id)->count(),
            'live_alerts' => Incident::alerts()->where('status', Incident::VERIFIED)->count(),
            // the signed-in person's number id, to match reporter and assignee ids
            'me' => $request->user()->id,
            'default_agency' => app(\App\Services\SettingService::class)->get('reports', 'default_agency') ?: 'PDRM IPD Melaka Tengah',
            'statuses' => collect(Incident::STATUSES)->mapWithKeys(fn ($s) => [$s => (int) ($counts[$s] ?? 0)]),
        ]]);
    }

    /**
     * GET /admin/incidents?filter[queue]=check|waiting|checking|mine|alerts|decided&filter[status][]=&filter[type]=&filter[area]=
     *   &filter[severity][]=&filter[assigned]=me|none|{id}&filter[q]=&filter[from]=&filter[to]=&sort=-created_at
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $page = QueryBuilder::for(Incident::query()->with(['type', 'area', 'reporter', 'assignee'])->withCount('evidences'))
            ->allowedFilters(
                AllowedFilter::callback('queue', fn (Builder $q, $value) => match ($value) {
                    'check' => $q->where('status', Incident::NEW),
                    'waiting' => $q->where('status', Incident::NEEDS_INFO),
                    'checking' => $q->where('status', Incident::INVESTIGATING),
                    'mine' => $q->whereIn('status', Incident::OPEN)->where('assigned_to', $user->id),
                    'alerts' => $q->alerts(),
                    'decided' => $q->whereNotIn('status', Incident::OPEN),
                    default => $q,
                }),
                AllowedFilter::callback('status', fn (Builder $q, $value) => $q->whereIn('status', (array) $value)),
                AllowedFilter::callback('type', fn (Builder $q, $value) => $q->whereHas('type', fn (Builder $t) => $t->whereIn('slug', (array) $value))),
                AllowedFilter::callback('severity', fn (Builder $q, $value) => $q->whereIn('severity', (array) $value)),
                AllowedFilter::callback('area', function (Builder $q, $value) {
                    $area = Area::where('slug', $value)->first();
                    $q->whereIn('area_id', $area ? $area->selfAndChildIds() : [0]);
                }),
                AllowedFilter::callback('assigned', fn (Builder $q, $value) => match ($value) {
                    'me' => $q->where('assigned_to', $user->id),
                    'none' => $q->whereNull('assigned_to'),
                    default => $q->where('assigned_to', (int) $value),
                }),
                AllowedFilter::callback('alert', fn (Builder $q, $value) => filter_var($value, FILTER_VALIDATE_BOOL) ? $q->alerts() : $q->whereNull('alert_published_at')),
                AllowedFilter::callback('from', fn (Builder $q, $value) => $q->whereDate('created_at', '>=', $value)),
                AllowedFilter::callback('to', fn (Builder $q, $value) => $q->whereDate('created_at', '<=', $value)),
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('reference_no', 'like', "%{$value}%")->orWhere('title', 'like', "%{$value}%")
                    ->orWhere('description', 'like', "%{$value}%")->orWhere('address', 'like', "%{$value}%")
                    ->orWhereHas('reporter', fn (Builder $u) => $u->where('name', 'like', "%{$value}%")->orWhere('email', 'like', "%{$value}%")))),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('created_at', 'occurred_at', 'updated_at', 'reference_no',
                \Spatie\QueryBuilder\AllowedSort::callback('severity', fn (Builder $q, bool $desc) => $q->orderByRaw(
                    "case severity when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end ".($desc ? 'desc' : 'asc')
                )))
            ->defaultSort('created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Incident $i) => IncidentPresent::admin($i)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    public function show(Incident $incident): JsonResponse
    {
        return response()->json(['data' => $this->detail($incident)]);
    }

    /**
     * POST /admin/incidents/{ref}/action
     * { action: assign|unassign|request_info|investigate|verify|unconfirm|reject|close|reopen, ... }
     */
    public function action(Request $request, Incident $incident): JsonResponse
    {
        $action = $request->input('action');
        $data = $request->validate([
            'action' => ['required', Rule::in(['assign', 'unassign', 'request_info', 'investigate', 'verify', 'unconfirm', 'reject', 'close', 'reopen'])],
            'user' => ['nullable', 'integer', 'exists:users,id'],
            'message' => [Rule::requiredIf(in_array($action, ['request_info', 'unconfirm', 'reject', 'reopen'], true)), 'nullable', 'string', 'max:2000'],
            'note' => ['nullable', 'string', 'max:2000'],
            'severity' => ['nullable', Rule::in(Incident::SEVERITIES)],
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['boolean'],
            'publish_alert' => ['sometimes', 'boolean'],
            'public_title' => ['nullable', 'string', 'max:150'],
            'public_summary' => ['nullable', 'string', 'max:3000'],
            'public_address' => ['nullable', 'string', 'max:200'],
            'duplicate_of' => ['nullable', 'string', 'max:30'],
        ], ['message.required' => 'Please write a short message. The reporter will see it.']);
        $actor = $request->user();

        $message = match ($data['action']) {
            'assign' => tap('Assigned.', fn () => $this->incidents->assign($incident, $actor, isset($data['user']) ? User::find($data['user']) : $actor)),
            'unassign' => tap('No longer assigned.', fn () => $this->incidents->assign($incident, $actor, null)),
            'request_info' => tap('Question sent to the reporter.', fn () => $this->incidents->requestInfo($incident, $actor, $data['message'])),
            'investigate' => tap('Moved to "Checking".', fn () => $this->incidents->investigate($incident, $actor, $data['note'] ?? null)),
            'verify' => ($data['publish_alert'] ?? false) ? tap('Verified. The alert is now on the site.', fn () => $this->incidents->verify($incident, $actor, $data))
                : tap('Verified. The report stays private until you publish an alert.', fn () => $this->incidents->verify($incident, $actor, $data)),
            'unconfirm' => tap('Marked as unconfirmed. The reporter has been told why.', fn () => $this->incidents->unconfirm($incident, $actor, $data['message'], $data['checklist'] ?? [])),
            'reject' => tap('Report closed. The reporter has been told why.', fn () => $this->incidents->reject($incident, $actor, $data['message'], $data['duplicate_of'] ?? null)),
            'close' => tap('Report closed.', fn () => $this->incidents->close($incident, $actor, $data['note'] ?? null)),
            'reopen' => tap('Report reopened for checking.', fn () => $this->incidents->reopen($incident, $actor, $data['message'])),
        };

        return response()->json(['message' => $message, 'data' => $this->detail($incident->fresh())]);
    }

    /** POST /admin/incidents/bulk { action: assign_me|investigate|reject, ids: ref[], message? } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['assign_me', 'investigate', 'reject'])],
            'ids' => ['required', 'array', 'max:100'],
            'ids.*' => ['string'],
            'message' => ['required_if:action,reject', 'nullable', 'string', 'max:2000'],
        ], ['message.required_if' => 'Please write a short reason. Each reporter will see it.']);
        $done = 0;
        $skipped = 0;
        foreach (Incident::whereIn('reference_no', $data['ids'])->get() as $incident) {
            try {
                match ($data['action']) {
                    'assign_me' => $this->incidents->assign($incident, $request->user(), $request->user()),
                    'investigate' => $this->incidents->investigate($incident, $request->user()),
                    'reject' => $this->incidents->reject($incident, $request->user(), $data['message']),
                };
                $done++;
            } catch (FriendlyException) {
                $skipped++;
            }
        }
        $verb = ['assign_me' => 'assigned to you', 'investigate' => 'moved to "Checking"', 'reject' => 'closed'][$data['action']];
        $message = $done === 1 ? "1 report {$verb}." : "{$done} reports {$verb}.";
        if ($skipped) {
            $message .= $skipped === 1 ? ' 1 was skipped because it was already decided.' : " {$skipped} were skipped because they were already decided.";
        }

        return response()->json(['message' => $message, 'done' => $done, 'skipped' => $skipped]);
    }

    /** PUT /admin/incidents/{ref}/alert { public_title?, public_summary?, public_address?, severity?, published? } */
    public function alert(Request $request, Incident $incident): JsonResponse
    {
        $data = $request->validate([
            'public_title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'public_summary' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'public_address' => ['sometimes', 'nullable', 'string', 'max:200'],
            'severity' => ['sometimes', Rule::in(Incident::SEVERITIES)],
            'published' => ['sometimes', 'boolean'],
        ]);
        $wasPublished = $incident->alert_published_at !== null;
        $this->incidents->updateAlert($incident, $request->user(), $data);
        $message = match (true) {
            ! $wasPublished && $incident->alert_published_at !== null => 'The alert is now on the site.',
            $wasPublished && $incident->alert_published_at === null => 'The alert was taken off the site.',
            default => 'Alert saved.',
        };

        return response()->json(['message' => $message, 'data' => $this->detail($incident->fresh())]);
    }

    /** POST /admin/incidents/{ref}/notes { body, to_reporter } */
    public function note(Request $request, Incident $incident): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:3000'], 'to_reporter' => ['sometimes', 'boolean']]);
        $toReporter = (bool) ($data['to_reporter'] ?? false);
        $this->incidents->note($incident, $request->user(), $data['body'], $toReporter);

        return response()->json(['message' => $toReporter ? 'Message sent to the reporter.' : 'Note added.', 'data' => $this->detail($incident->fresh())]);
    }

    /** POST /admin/incidents/{ref}/evidence (multipart files[]) */
    public function addEvidence(Request $request, Incident $incident): JsonResponse
    {
        $request->validate(['files' => ['required', 'array', 'max:10'], 'files.*' => $this->evidence->fileRules()], [
            'files.*.max' => 'One of the files is too big.',
            'files.*.extensions' => 'Please use photos, videos, voice recordings or PDF files.',
        ]);
        $this->incidents->staffEvidence($incident, $request->user(), $request->file('files'), $request);

        return response()->json(['message' => 'Files added to the evidence.', 'data' => $this->detail($incident->fresh())]);
    }

    /** GET /admin/incidents/{ref}/evidence/{evidence}: the original file. Every download is written to the audit log. */
    public function download(Request $request, Incident $incident, IncidentEvidence $evidence): StreamedResponse
    {
        if ($evidence->incident_id !== $incident->id) {
            throw new FriendlyException('That file is not part of this report.', 'NOT_FOUND', 404);
        }
        if (! $evidence->disk_path || ! Storage::disk(EvidenceStore::DISK)->exists($evidence->disk_path)) {
            throw new FriendlyException('This file is no longer kept.', 'EVIDENCE_PURGED', 410);
        }
        activity('civic')->performedOn($incident)->causedBy($request->user())
            ->withProperties(['evidence' => $evidence->ulid, 'name' => $evidence->original_name, 'sha256' => $evidence->sha256, 'ip' => $request->ip()])
            ->event('evidence_viewed')->log('Evidence file opened');

        $inline = $request->boolean('inline') && in_array($evidence->kind, ['image', 'video', 'audio'], true);

        return Storage::disk(EvidenceStore::DISK)->response($evidence->disk_path, $evidence->original_name, [
            'Content-Type' => $evidence->mime,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }

    /** GET /admin/incidents/{ref}/evidence/{evidence}/check: re-hash the stored file. */
    public function check(Incident $incident, IncidentEvidence $evidence): JsonResponse
    {
        if ($evidence->incident_id !== $incident->id) {
            throw new FriendlyException('That file is not part of this report.', 'NOT_FOUND', 404);
        }
        $intact = $this->evidence->intact($evidence);

        return response()->json([
            'intact' => $intact,
            'message' => match ($intact) {
                true => 'The file is unchanged since it arrived.',
                false => 'This file does not match the copy we received. Please tell the site admin.',
                null => 'This file is no longer kept, so it can’t be checked.',
            },
        ]);
    }

    /** POST /admin/incidents/{ref}/photos (multipart photo, alt?): a blurred copy for the public alert. */
    public function addPhoto(Request $request, Incident $incident): JsonResponse
    {
        $request->validate(['photo' => ['required', 'image', 'max:10240'], 'alt' => ['nullable', 'string', 'max:200']]);
        $this->incidents->addPublicPhoto($incident, $request->user(), $request->file('photo'), $request->input('alt'));

        return response()->json(['message' => 'Photo added to the alert.', 'data' => $this->detail($incident->fresh())]);
    }

    public function reorderPhotos(Request $request, Incident $incident): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['string']]);
        $this->incidents->reorderPublicPhotos($incident, $data['ids']);

        return response()->json(['message' => 'Photo order saved.', 'data' => $this->detail($incident->fresh())]);
    }

    public function removePhoto(Request $request, Incident $incident, Media $media): JsonResponse
    {
        $this->incidents->removePublicPhoto($incident, $request->user(), $media);

        return response()->json(['message' => 'Photo removed from the alert.', 'data' => $this->detail($incident->fresh())]);
    }

    /** GET /admin/incidents/verifiers: people who can be assigned. */
    public function verifiers(): JsonResponse
    {
        $users = User::permission('incidents.verify')->orderBy('name')->get(['id', 'name'])
            ->merge(User::role('super-admin')->get(['id', 'name']))->unique('id')->sortBy('name')->values();

        return response()->json(['data' => $users->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])]);
    }

    private function detail(Incident $incident): array
    {
        $incident->load(self::DETAIL);

        return IncidentPresent::adminDetail($incident, $this->incidents->nearby($incident)->all());
    }
}
