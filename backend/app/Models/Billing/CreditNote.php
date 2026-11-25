<?php

namespace App\Models\Billing;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Reduces what an issued invoice is worth, e.g. a cancelled campaign. Never edited once issued. */
class CreditNote extends Model
{
    use HasUlids, LogsActivity;

    protected $fillable = [
        'invoice_id', 'customer_id', 'issue_date', 'reason', 'description', 'subtotal_sen', 'tax_rate', 'tax_sen', 'total_sen',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'seller' => 'array',
            'buyer' => 'array',
            'tax_rate' => 'decimal:2',
            'subtotal_sen' => 'integer',
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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('billing')
            ->logOnly(['number', 'reason', 'total_sen'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Credit note {$this->number} {$event}");
    }
}
