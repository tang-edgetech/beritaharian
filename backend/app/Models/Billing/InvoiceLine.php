<?php

namespace App\Models\Billing;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class InvoiceLine extends Model
{
    protected $fillable = [
        'position', 'description', 'quantity', 'unit', 'unit_price_sen', 'discount_sen', 'tax_rate', 'tax_sen', 'amount_sen',
        'billable_type', 'billable_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'unit_price_sen' => 'integer',
            'discount_sen' => 'integer',
            'tax_sen' => 'integer',
            'amount_sen' => 'integer',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /** Later: the plan or paid placement this line is for. */
    public function billable(): MorphTo
    {
        return $this->morphTo();
    }
}
