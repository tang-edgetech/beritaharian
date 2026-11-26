<?php

namespace App\Models\Civic;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One line on an incident's timeline. Only rows marked visible_to_reporter are shown to the reporter. */
class IncidentUpdate extends Model
{
    public const KINDS = ['submitted', 'status', 'note', 'message', 'reply', 'evidence', 'assigned', 'alert', 'handover'];

    protected $fillable = ['incident_id', 'user_id', 'kind', 'from_status', 'to_status', 'body', 'visible_to_reporter', 'meta'];

    protected function casts(): array
    {
        return ['visible_to_reporter' => 'boolean', 'meta' => 'array'];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
