<?php

namespace App\Services\Civic;

use App\Models\Civic\Incident;
use App\Models\Civic\IncidentEvidence;
use App\Models\User;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Keeps original files exactly as they arrived. Each one is hashed (SHA-256) before anything else
 * touches it, its camera details (EXIF) are read but not removed, and the uploader's IP and browser
 * are recorded, so the file can be shown to the police unchanged.
 */
class EvidenceStore
{
    public const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'mp4', 'mov', 'webm', '3gp', 'm4a', 'mp3', 'aac', 'wav', 'ogg', 'pdf'];

    public const DISK = 'local';

    public function __construct(private SettingService $settings) {}

    /** Validation rules for one uploaded file, using the size limit from Settings › Reports. */
    public function fileRules(): array
    {
        $maxKb = (int) $this->settings->get('reports', 'max_file_mb', 25) * 1024;

        return ['file', 'max:'.$maxKb, 'extensions:'.implode(',', self::EXTENSIONS)];
    }

    public function maxFiles(): int
    {
        return (int) $this->settings->get('reports', 'max_files', 6);
    }

    public function store(Incident $incident, UploadedFile $file, ?User $user, string $source, ?Request $request = null): IncidentEvidence
    {
        $realPath = $file->getRealPath();
        $sha256 = hash_file('sha256', $realPath);
        $mime = $file->getMimeType() ?: 'application/octet-stream';
        $extension = Str::lower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $ulid = Str::lower((string) Str::ulid());
        [$exif, $captured] = $this->exif($realPath, $mime);

        // the file is copied byte for byte; nothing is resized or re-encoded
        $path = $file->storeAs("incidents/{$incident->ulid}", "{$ulid}.{$extension}", self::DISK);

        return IncidentEvidence::create([
            'ulid' => $ulid,
            'incident_id' => $incident->id,
            'uploaded_by' => $user?->id,
            'source' => $source,
            'kind' => $this->kind($mime, $extension),
            'disk_path' => $path,
            'original_name' => Str::limit($file->getClientOriginalName() ?: "file.{$extension}", 190, ''),
            'mime' => $mime,
            'size' => $file->getSize() ?: 0,
            'sha256' => $sha256,
            'exif' => $exif ?: null,
            'captured_at' => $captured,
            'uploader_ip' => $request?->ip(),
            'user_agent' => $request ? Str::limit((string) $request->userAgent(), 290, '') : null,
        ]);
    }

    /** Re-hash the stored file: true when it still matches the hash taken at upload. */
    public function intact(IncidentEvidence $evidence): ?bool
    {
        if (! $evidence->disk_path || ! Storage::disk(self::DISK)->exists($evidence->disk_path)) {
            return null;
        }

        return hash_file('sha256', Storage::disk(self::DISK)->path($evidence->disk_path)) === $evidence->sha256;
    }

    /** Delete the file but keep the row (name, hash, times) as a record that it existed. */
    public function purge(IncidentEvidence $evidence): void
    {
        if ($evidence->disk_path) {
            Storage::disk(self::DISK)->delete($evidence->disk_path);
        }
        $evidence->forceFill(['disk_path' => null, 'purged_at' => now()])->save();
    }

    private function kind(string $mime, string $extension): string
    {
        return match (true) {
            str_starts_with($mime, 'image/') || in_array($extension, ['heic', 'heif'], true) => 'image',
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'audio/') => 'audio',
            default => 'document',
        };
    }

    /** Camera make and model, the time the photo was taken and where, if the phone recorded them. */
    private function exif(string $path, string $mime): array
    {
        if (! in_array($mime, ['image/jpeg', 'image/tiff'], true) || ! function_exists('exif_read_data')) {
            return [null, null];
        }
        try {
            $raw = @exif_read_data($path) ?: [];
        } catch (Throwable) {
            return [null, null];
        }

        $exif = array_filter([
            'make' => $raw['Make'] ?? null,
            'model' => $raw['Model'] ?? null,
            'software' => $raw['Software'] ?? null,
            'taken_at' => $raw['DateTimeOriginal'] ?? ($raw['DateTime'] ?? null),
            'width' => $raw['COMPUTED']['Width'] ?? null,
            'height' => $raw['COMPUTED']['Height'] ?? null,
            'latitude' => $this->gps($raw['GPSLatitude'] ?? null, $raw['GPSLatitudeRef'] ?? null),
            'longitude' => $this->gps($raw['GPSLongitude'] ?? null, $raw['GPSLongitudeRef'] ?? null),
        ], fn ($v) => $v !== null && $v !== '');
        $exif = array_map(fn ($v) => is_string($v) ? mb_convert_encoding(trim($v), 'UTF-8', 'UTF-8') : $v, $exif);

        $captured = null;
        if (! empty($exif['taken_at'])) {
            try {
                $captured = Carbon::createFromFormat('Y:m:d H:i:s', $exif['taken_at'], config('app.timezone'));
            } catch (Throwable) {
                $captured = null;
            }
        }

        return [$exif, $captured];
    }

    private function gps(?array $parts, ?string $ref): ?float
    {
        if (! $parts || count($parts) < 3) {
            return null;
        }
        $toFloat = function (string $v): float {
            [$a, $b] = array_pad(explode('/', $v), 2, '1');

            return (float) $b === 0.0 ? 0.0 : (float) $a / (float) $b;
        };
        $value = $toFloat($parts[0]) + $toFloat($parts[1]) / 60 + $toFloat($parts[2]) / 3600;

        return round(in_array($ref, ['S', 'W'], true) ? -$value : $value, 7);
    }
}
