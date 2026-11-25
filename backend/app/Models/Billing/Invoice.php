<?php

namespace App\Models\Billing;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Invoice extends Model
{
    use HasUlids, LogsActivity;

    public const DRAFT = 'draft';

    public const ISSUED = 'issued';

    public const PARTIALLY_PAID = 'partially_paid';

    public const PAID = 'paid';

    public const CREDITED = 'credited';

    public const VOID = 'void';

    public const STATUSES = [self::DRAFT, self::ISSUED, self::PARTIALLY_PAID, self::PAID, self::CREDITED, self::VOID];

    /** Still waiting for money. */
    public const OPEN = [self::ISSUED, self::PARTIALLY_PAID];

    protected $fillable = [
        'customer_id', 'status', 'issue_date', 'due_date', 'currency', 'reference', 'notes', 'terms', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'seller' => 'array',
            'buyer' => 'array',
            'einvoice' => 'array',
            'issued_at' => 'datetime',
            'voided_at' => 'datetime',
            'subtotal_sen' => 'integer',
            'discount_sen' => 'integer',
            'tax_sen' => 'integer',
            'total_sen' => 'integer',
            'paid_sen' => 'integer',
            'refunded_sen' => 'integer',
            'credited_sen' => 'integer',
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

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class)->orderBy('position');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('paid_on')->latest('id');
    }

    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class)->latest('issue_date')->latest('id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    /** What the customer still owes. Negative means we owe them a refund. */
    public function balanceSen(): int
    {
        if ($this->status === self::VOID || $this->status === self::DRAFT) {
            return 0;
        }

        return $this->total_sen - $this->credited_sen - $this->paid_sen + $this->refunded_sen;
    }

    public function isDraft(): bool
    {
        return $this->status === self::DRAFT;
    }

    public function isOverdue(): bool
    {
        return in_array($this->status, self::OPEN, true) && $this->due_date && $this->due_date->lt(today());
    }

    public function displayNumber(): string
    {
        return $this->number ?? 'Draft';
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN)->whereDate('due_date', '<', today());
    }

    /** Issued in the accounts: everything except drafts and voids. */
    public function scopeCounted(Builder $query): Builder
    {
        return $query->whereNotIn('status', [self::DRAFT, self::VOID]);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('billing')
            ->logOnly(['number', 'status', 'issue_date', 'due_date', 'total_sen', 'paid_sen', 'credited_sen', 'refunded_sen', 'void_reason'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => 'Invoice '.($this->number ?? 'draft')." {$event}");
    }
}
