<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Civic\IncidentPresent;
use App\Models\Civic\Incident;
use App\Services\Civic\EvidenceStore;
use App\Services\Civic\IncidentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A signed-in reader's own civic reports: send one, follow it, answer questions, add files, withdraw. */
class ReportAccountController extends Controller
{
    // Melaka state with a margin, so a pin dropped in the sea or in another state is caught early.
    private const BOUNDS = ['lat' => [1.85, 2.60], 'lng' => [101.90, 102.70]];

    public function __construct(private IncidentService $incidents, private EvidenceStore $evidence) {}

    /** GET /me/reports?state=open|decided */
    public function index(Request $request): JsonResponse
    {
        $page = Incident::with(['type', 'area'])
            ->where('reporter_id', $request->user()->id)
            ->when($request->query('state') === 'open', fn ($q) => $q->whereIn('status', Incident::OPEN))
            ->when($request->query('state') === 'decided', fn ($q) => $q->whereNotIn('status', Incident::OPEN))
            ->latest('id')
            ->paginate(20)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Incident $i) => IncidentPresent::mine($i)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            'limits' => ['max_files' => $this->evidence->maxFiles(), 'extensions' => EvidenceStore::EXTENSIONS],
        ]);
    }

    public function show(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => IncidentPresent::mineDetail($this->find($request, $ref))]);
    }

    /** POST /me/reports (multipart) */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'max:80'],
            'latitude' => ['required', 'numeric', 'between:'.implode(',', self::BOUNDS['lat'])],
            'longitude' => ['required', 'numeric', 'between:'.implode(',', self::BOUNDS['lng'])],
            'address' => ['nullable', 'string', 'max:300'],
            'occurred_at' => ['required', 'date', 'before_or_equal:'.now()->addMinutes(5)->toIso8601String(), 'after_or_equal:'.now()->subDays(30)->toDateString()],
            'title' => ['required', 'string', 'min:5', 'max:150'],
            'description' => ['required', 'string', 'min:20', 'max:5000'],
            'is_anonymous' => ['sometimes', 'boolean'],
            'consent' => ['accepted'],
            'files' => ['sometimes', 'array', 'max:'.$this->evidence->maxFiles()],
            'files.*' => $this->evidence->fileRules(),
        ], [
            'latitude.between' => 'Please drop the pin inside Melaka.',
            'longitude.between' => 'Please drop the pin inside Melaka.',
            'occurred_at.before_or_equal' => 'The time can’t be in the future.',
            'occurred_at.after_or_equal' => 'We can only take reports of things from the last 30 days.',
            'description.min' => 'Please describe what happened in a little more detail (at least 20 characters).',
            'consent.accepted' => 'Please confirm you have read how we use your report.',
            'files.max' => "You can add up to {$this->evidence->maxFiles()} files.",
            'files.*.max' => 'One of the files is too big.',
            'files.*.extensions' => 'Please use photos, videos, voice recordings or PDF files.',
        ]);

        $incident = $this->incidents->submit($request->user(), $data, $request->file('files', []), $request);

        return response()->json([
            'message' => "Thank you. Your report {$incident->reference_no} is with our team. We’ll let you know what happens.",
            'data' => IncidentPresent::mineDetail($incident->fresh()->load(['type', 'area', 'evidences', 'updates', 'duplicateOf'])),
        ], 201);
    }

    /** POST /me/reports/{ref}/updates (multipart) { message?, files[]? } */
    public function update(Request $request, string $ref): JsonResponse
    {
        $incident = $this->find($request, $ref);
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:3000'],
            'files' => ['sometimes', 'array', 'max:'.$this->evidence->maxFiles()],
            'files.*' => $this->evidence->fileRules(),
        ], ['files.*.max' => 'One of the files is too big.', 'files.*.extensions' => 'Please use photos, videos, voice recordings or PDF files.']);

        $this->incidents->reporterUpdate($incident, $request->user(), $data['message'] ?? null, $request->file('files', []), $request);

        return response()->json(['message' => 'Sent. Our team will see it.', 'data' => IncidentPresent::mineDetail($this->find($request, $ref))]);
    }

    /** POST /me/reports/{ref}/withdraw */
    public function withdraw(Request $request, string $ref): JsonResponse
    {
        $this->incidents->withdraw($this->find($request, $ref), $request->user());

        return response()->json(['message' => 'Report withdrawn. The files you sent have been deleted.', 'data' => IncidentPresent::mineDetail($this->find($request, $ref))]);
    }

    private function find(Request $request, string $ref): Incident
    {
        $incident = Incident::with(['type', 'area', 'evidences', 'updates', 'duplicateOf'])
            ->where('reference_no', $ref)->where('reporter_id', $request->user()->id)->first();
        if (! $incident) {
            throw new FriendlyException('We couldn’t find that report in your account.', 'NOT_FOUND', 404);
        }

        return $incident;
    }
}
