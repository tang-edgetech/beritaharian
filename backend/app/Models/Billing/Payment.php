<?php

namespace App\Models\Billing;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Money received for an invoice (kind "payment") or paid back to the customer (kind "refund"). */
class Payment extends Model
{
    use HasUlids, LogsActivity;

    public const PENDING = 'pending';

    public const CONFIRMED = 'confirmed';

    public const REJECTED = 'rejected';

    public const KIND_PAYMENT = 'payment';

    public const KIND_REFUND = 'refund';

    public const METHODS = [
        'bank_transfer' => 'Bank transfer',
        'duitnow' => 'DuitNow',
        'cash' => 'Cash',
        'cheque' => 'Cheque',
        'card' => 'Card',
        'ewallet' => 'E-wallet',
        'other' => 'Other',
    ];

    protected $fillable = [
        'invoice_id', 'customer_id', 'kind', 'method', 'reference', 'amount_sen', 'paid_on', 'status', 'slip_path', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'paid_on' => 'date',
            'confirmed_at' => 'datetime',
            'amount_sen' => 'integer',
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

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function isRefund(): bool
    {
        return $this->kind === self::KIND_REFUND;
    }

    public function methodLabel(): string
    {
        return self::METHODS[$this->method] ?? ucfirst($this->method);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('billing')
            ->logOnly(['receipt_number', 'kind', 'amount_sen', 'method', 'paid_on', 'status', 'rejected_reason'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => ($this->isRefund() ? 'Refund' : 'Payment')." {$event}");
    }
}
