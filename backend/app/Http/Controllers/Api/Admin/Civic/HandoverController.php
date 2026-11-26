<?php

namespace App\Http\Controllers\Api\Admin\Civic;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Civic\IncidentPresent;
use App\Models\Civic\EvidenceHandover;
use App\Models\Civic\Incident;
use App\Services\Civic\EvidencePackService;
use App\Services\Civic\EvidenceStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Evidence packs for the police, and the log of who received them. */
class HandoverController extends Controller
{
    public function __construct(private EvidencePackService $packs) {}

    /** POST /admin/incidents/{ref}/handovers { agency, officer_name, officer_id?, police_report_no, notes?, evidence?: ulid[] } */
    public function store(Request $request, Incident $incident): JsonResponse
    {
        $data = $request->validate([
            'agency' => ['required', 'string', 'max:150'],
            'officer_name' => ['required', 'string', 'max:150'],
            'officer_id' => ['nullable', 'string', 'max:60'],
            'police_report_no' => ['required', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'evidence' => ['nullable', 'array'],
            'evidence.*' => ['string'],
        ], [
            'officer_name.required' => 'Please enter the name of the officer receiving the pack.',
            'police_report_no.required' => 'Please enter the police report number.',
        ]);
        if ($incident->status === Incident::WITHDRAWN) {
            throw new FriendlyException('This report was withdrawn by the reporter and its files were deleted.', 'WITHDRAWN');
        }

        $handover = $this->packs->create($incident, $request->user(), $data);

        return response()->json(['message' => 'Evidence pack ready to download.', 'data' => IncidentPresent::handover($handover->load('exporter'))], 201);
    }

    /** GET /admin/incidents/{ref}/handovers/{handover}/download: every download is logged. */
    public function download(Request $request, Incident $incident, EvidenceHandover $handover): StreamedResponse
    {
        if ($handover->incident_id !== $incident->id) {
            throw new FriendlyException('That pack is not part of this report.', 'NOT_FOUND', 404);
        }
        if (! $handover->pack_path || ! Storage::disk(EvidenceStore::DISK)->exists($handover->pack_path)) {
            throw new FriendlyException('Some files are still processing. Try again in a minute.', 'PACK_MISSING', 404);
        }
        activity('civic')->performedOn($incident)->causedBy($request->user())
            ->withProperties(['handover' => $handover->ulid, 'pack_sha256' => $handover->pack_sha256, 'ip' => $request->ip()])
            ->event('pack_downloaded')->log('Evidence pack downloaded');

        return Storage::disk(EvidenceStore::DISK)->download($handover->pack_path, basename($handover->pack_path), [
            'Content-Type' => 'application/zip',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
