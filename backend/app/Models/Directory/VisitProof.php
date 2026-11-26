<?php

namespace App\Models\Directory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Proof that a reviewer was there. Receipt photos sit on the private disk and are deleted 90 days after the check. */
class VisitProof extends Model
{
    public const RECEIPT = 'receipt';

    public const CHECKIN = 'checkin';

    protected $fillable = ['review_id', 'kind', 'path', 'latitude', 'longitude', 'distance_m', 'status', 'verified_by', 'verified_at', 'purge_after'];

    protected $hidden = ['path', 'latitude', 'longitude'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'distance_m' => 'integer', 'verified_at' => 'datetime', 'purge_after' => 'datetime'];
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class)->withTrashed();
    }
}
