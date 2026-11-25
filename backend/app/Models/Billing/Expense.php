<?php

namespace App\Models\Billing;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Money spent by the business: hosting, printing, transport. Keeps the supplier's bill as an attachment. */
class Expense extends Model
{
    use HasUlids, LogsActivity, SoftDeletes;

    protected $fillable = [
        'spent_on', 'category', 'payee', 'description', 'reference', 'method', 'amount_sen', 'tax_sen', 'total_sen', 'attachment_path', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount_sen' => 'integer',
            'tax_sen' => 'integer',
            'total_sen' => 'integer',
        ];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('billing')
            ->logOnly(['spent_on', 'category', 'payee', 'description', 'amount_sen', 'tax_sen', 'total_sen'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Expense {$this->number} {$event}");
    }
}
