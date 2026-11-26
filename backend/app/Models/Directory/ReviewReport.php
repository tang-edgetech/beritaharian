<?php

namespace App\Models\Directory;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Someone (often the owner) flagging a review for a moderator. Reports never hide a review by themselves. */
class ReviewReport extends Model
{
    protected $fillable = ['review_id', 'user_id', 'reason', 'note', 'status', 'resolved_by', 'resolved_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class)->withTrashed();
    }
}
