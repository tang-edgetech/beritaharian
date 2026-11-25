<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginHistory extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'identifier', 'ip', 'user_agent', 'succeeded', 'reason'];

    protected function casts(): array
    {
        return ['succeeded' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
