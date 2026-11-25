<?php

namespace App\Http\Resources\Billing;

use App\Models\Billing\CreditNote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CreditNote */
class CreditNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'number' => $this->number,
            'issue_date' => $this->issue_date?->toDateString(),
            'reason' => $this->reason,
            'description' => $this->description,
            'subtotal_sen' => $this->subtotal_sen,
            'tax_rate' => (float) $this->tax_rate,
            'tax_sen' => $this->tax_sen,
            'total_sen' => $this->total_sen,
            'invoice' => $this->whenLoaded('invoice', fn () => ['id' => $this->invoice->ulid, 'number' => $this->invoice->number]),
            'customer' => $this->whenLoaded('customer', fn () => ['id' => $this->customer->ulid, 'name' => $this->customer->name]),
            'issued_by' => $this->whenLoaded('issuer', fn () => $this->issuer?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
