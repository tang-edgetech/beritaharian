<?php

namespace App\Http\Resources\Billing;

use App\Models\Billing\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Invoice */
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'number' => $this->number,
            'status' => $this->status,
            'is_overdue' => $this->isOverdue(),
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->ulid,
                'name' => $this->buyer['name'] ?? $this->customer->name,
            ]),
            'issue_date' => $this->issue_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'reference' => $this->reference,
            'currency' => $this->currency,
            'subtotal_sen' => $this->subtotal_sen,
            'discount_sen' => $this->discount_sen,
            'tax_sen' => $this->tax_sen,
            'total_sen' => $this->total_sen,
            'paid_sen' => $this->paid_sen,
            'refunded_sen' => $this->refunded_sen,
            'credited_sen' => $this->credited_sen,
            'balance_sen' => $this->balanceSen(),
            'notes' => $this->notes,
            'terms' => $this->terms,
            'seller' => $this->seller,
            'buyer' => $this->buyer,
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'description' => $line->description,
                'quantity' => (float) $line->quantity,
                'unit' => $line->unit,
                'unit_price_sen' => $line->unit_price_sen,
                'discount_sen' => $line->discount_sen,
                'tax_rate' => (float) $line->tax_rate,
                'tax_sen' => $line->tax_sen,
                'amount_sen' => $line->amount_sen,
            ])),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'credit_notes' => CreditNoteResource::collection($this->whenLoaded('creditNotes')),
            'issued_at' => $this->issued_at?->toIso8601String(),
            'issued_by' => $this->whenLoaded('issuer', fn () => $this->issuer?->name),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'void_reason' => $this->void_reason,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
