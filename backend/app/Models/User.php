<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, LogsActivity, Notifiable, SoftDeletes;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_BANNED = 'banned';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_SUSPENDED, self::STATUS_BANNED];

    protected $fillable = ['name', 'email', 'phone', 'password', 'status'];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            $user->ulid ??= (string) Str::ulid();
        });
        static::created(function (User $user) {
            $user->profile()->firstOrCreate([]);
        });
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    public function loginHistories(): HasMany
    {
        return $this->hasMany(LoginHistory::class);
    }

    public function otpCodes(): HasMany
    {
        return $this->hasMany(OtpCode::class);
    }

    /** An account counts as verified once either its email or its phone is confirmed. */
    public function isVerified(): bool
    {
        return $this->email_verified_at !== null || $this->phone_verified_at !== null;
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_confirmed_at !== null && $this->two_factor_secret !== null;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('users')
            ->logOnly(['name', 'email', 'phone', 'status', 'email_verified_at', 'phone_verified_at', 'two_factor_confirmed_at'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
