<?php

namespace App\Services\Civic;

use App\Exceptions\FriendlyException;
use App\Models\Civic\EvidenceHandover;
use App\Models\Civic\Incident;
use App\Models\Civic\IncidentEvidence;
use App\Models\User;
use App\Services\SettingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

/**
 * Builds the pack handed to the police: a ZIP with a printed summary (PDF), the original files
 * exactly as uploaded, and a manifest listing each file's SHA-256. The manifest's own hash and
 * the ZIP's hash are saved on the handover record, so anyone can later prove the pack is unchanged.
 */
class EvidencePackService
{
    public function __construct(private EvidenceStore $store, private SettingService $settings) {}

    /** @param  array{agency: string, officer_name: string, officer_id?: ?string, police_report_no: string, notes?: ?string, evidence?: ?array}  $data */
    public function create(Incident $incident, User $actor, array $data): EvidenceHandover
    {
        $evidence = $incident->evidences()->with('uploader')->get();
        if (! empty($data['evidence'])) {
            $evidence = $evidence->whereIn('ulid', $data['evidence'])->values();
        }
        if ($evidence->isEmpty()) {
            throw new FriendlyException('Please choose at least one file for the pack.', 'NO_EVIDENCE');
        }
        foreach ($evidence as $item) {
            $intact = $this->store->intact($item);
            if ($intact === null) {
                throw new FriendlyException("“{$item->original_name}” is no longer kept, so it can’t go in the pack. Untick it and try again.", 'EVIDENCE_PURGED');
            }
            if ($intact === false) {
                // should never happen: the stored file no longer matches the hash taken at upload
                report(new \RuntimeException("Evidence {$item->ulid} failed its hash check"));
                throw new FriendlyException("“{$item->original_name}” doesn’t match the copy we received, so it can’t go in the pack. Please tell the site admin.", 'EVIDENCE_CHANGED');
            }
        }

        return DB::transaction(function () use ($incident, $actor, $data, $evidence) {
            $handover = new EvidenceHandover([
                'incident_id' => $incident->id,
                'exported_by' => $actor->id,
                'agency' => trim($data['agency']),
                'officer_name' => trim($data['officer_name']),
                'officer_id' => isset($data['officer_id']) ? trim((string) $data['officer_id']) ?: null : null,
                'police_report_no' => trim($data['police_report_no']),
                'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
                'evidence_ids' => $evidence->pluck('ulid')->all(),
            ]);
            $handover->ulid = Str::lower((string) Str::ulid());
            $handover->setRelation('exporter', $actor);

            [$zipPath, $manifestHash] = $this->build($incident, $handover, $evidence);
            $disk = Storage::disk(EvidenceStore::DISK);
            $handover->fill([
                'pack_path' => $zipPath,
                'pack_size' => $disk->size($zipPath),
                'manifest_sha256' => $manifestHash,
                'pack_sha256' => hash_file('sha256', $disk->path($zipPath)),
            ])->save();

            $incident->updates()->create([
                'user_id' => $actor->id,
                'kind' => 'handover',
                'body' => "Evidence pack handed to {$handover->agency} ({$handover->officer_name}), police report {$handover->police_report_no}.",
                'meta' => ['handover' => $handover->ulid, 'files' => $evidence->count()],
            ]);
            activity('civic')->performedOn($incident)->causedBy($actor)
                ->withProperties(['handover' => $handover->ulid, 'police_report_no' => $handover->police_report_no, 'manifest_sha256' => $manifestHash])
                ->event('handover')->log('Evidence pack prepared for the police');

            return $handover;
        });
    }

    /** @return array{0: string, 1: string} zip path on the private disk, manifest hash */
    private function build(Incident $incident, EvidenceHandover $handover, $evidence): array
    {
        $disk = Storage::disk(EvidenceStore::DISK);
        $dir = "incidents/{$incident->ulid}/handovers";
        $disk->makeDirectory($dir);
        $zipPath = "{$dir}/{$incident->reference_no}-{$handover->ulid}.zip";

        $entries = [];
        foreach ($evidence->values() as $i => $item) {
            $safe = Str::of($item->original_name)->replaceMatches('/[^A-Za-z0-9._-]+/', '-')->limit(80, '')->toString() ?: 'file';
            $entries[] = ['item' => $item, 'name' => sprintf('evidence/%02d-%s', $i + 1, $safe)];
        }

        $pdf = Pdf::loadView('civic.evidence-pack', [
            'incident' => $incident->loadMissing(['type', 'area', 'reporter', 'decider', 'updates.user']),
            'handover' => $handover,
            'entries' => $entries,
            'checklist' => Incident::CHECKLIST,
            'seller' => ['name' => $this->settings->get('company', 'business_name', 'Cendol Satay'), 'registration_no' => $this->settings->get('company', 'registration_no'), 'email' => $this->settings->get('company', 'email'), 'phone' => $this->settings->get('company', 'phone')],
            'logo' => 'data:image/png;base64,'.base64_encode(file_get_contents(resource_path('brand/logo.png'))),
        ])->setPaper('a4')->setOption(['isPhpEnabled' => true, 'isRemoteEnabled' => false, 'defaultFont' => 'DejaVu Sans'])->output();

        $lines = [
            "# Cendol Satay evidence pack {$incident->reference_no}",
            "# Handover {$handover->ulid}, prepared ".now()->toIso8601String(),
            '# Each line: SHA-256 of the file, two spaces, path inside this ZIP. Check with: sha256sum -c manifest.txt',
            hash('sha256', $pdf).'  summary.pdf',
        ];
        foreach ($entries as $entry) {
            $lines[] = "{$entry['item']->sha256}  {$entry['name']}";
        }
        $manifest = implode("\n", $lines)."\n";

        $zip = new ZipArchive;
        if ($zip->open($disk->path($zipPath), ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new FriendlyException('We couldn’t prepare the pack. Please try again in a minute.', 'PACK_FAILED', 500);
        }
        $zip->addFromString('summary.pdf', $pdf);
        $zip->addFromString('manifest.txt', $manifest);
        foreach ($entries as $entry) {
            $zip->addFile($disk->path($entry['item']->disk_path), $entry['name']);
            $zip->setCompressionName($entry['name'], ZipArchive::CM_STORE); // stored as-is
        }
        $zip->close();

        return [$zipPath, hash('sha256', $manifest)];
    }
}
