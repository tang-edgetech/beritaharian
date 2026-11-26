<?php

namespace App\Models\Civic;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One original file sent with a report. Stored privately and never edited; the SHA-256 taken at
 * upload lets anyone confirm later that the file is unchanged. Public alerts use separate blurred copies.
 */
class IncidentEvidence extends Model
{
    use HasUlids;

    protected $table = 'incident_evidences';

    protected $fillable = ['incident_id', 'uploaded_by', 'source', 'kind', 'disk_path', 'original_name', 'mime', 'size', 'sha256', 'exif', 'captured_at', 'uploader_ip', 'user_agent', 'purged_at'];

    protected $hidden = ['disk_path'];

    protected function casts(): array
    {
        return ['exif' => 'array', 'size' => 'integer', 'captured_at' => 'datetime', 'purged_at' => 'datetime'];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class)->withTrashed();
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by')->withTrashed();
    }
}
