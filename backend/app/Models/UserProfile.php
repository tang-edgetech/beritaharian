<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserProfile extends Model
{
    protected $fillable = ['display_name', 'avatar_path', 'user_type', 'preferred_locale', 'bio', 'notification_prefs'];

    protected function casts(): array
    {
        return ['notification_prefs' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
