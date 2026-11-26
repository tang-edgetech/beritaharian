<?php

namespace App\Models\Civic;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An evidence pack given to the police: who prepared it, which officer received it, and the hashes that prove what was in it. */
class EvidenceHandover extends Model
{
    use HasUlids;

    protected $fillable = ['incident_id', 'exported_by', 'agency', 'officer_name', 'officer_id', 'police_report_no', 'notes', 'evidence_ids', 'pack_path', 'pack_size', 'manifest_sha256', 'pack_sha256'];

    protected $hidden = ['pack_path'];

    protected function casts(): array
    {
        return ['evidence_ids' => 'array', 'pack_size' => 'integer'];
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

    public function exporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'exported_by')->withTrashed();
    }
}
