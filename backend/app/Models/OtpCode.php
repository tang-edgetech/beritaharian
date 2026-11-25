<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OtpCode extends Model
{
    public const PURPOSE_VERIFY_ACCOUNT = 'verify_account';

    public const PURPOSE_RESET_PASSWORD = 'reset_password';

    protected $fillable = ['channel', 'destination', 'purpose', 'code_hash', 'attempts', 'expires_at', 'consumed_at'];

    protected $hidden = ['code_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
