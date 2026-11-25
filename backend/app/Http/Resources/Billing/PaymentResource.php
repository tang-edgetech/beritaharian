<?php

namespace App\Http\Resources\Billing;

use App\Models\Billing\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Payment */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'receipt_number' => $this->receipt_number,
            'kind' => $this->kind,
            'method' => $this->method,
            'method_label' => $this->methodLabel(),
            'reference' => $this->reference,
            'amount_sen' => $this->amount_sen,
            'paid_on' => $this->paid_on?->toDateString(),
            'status' => $this->status,
            'has_slip' => (bool) $this->slip_path,
            'notes' => $this->notes,
            'rejected_reason' => $this->rejected_reason,
            'invoice' => $this->whenLoaded('invoice', fn () => ['id' => $this->invoice->ulid, 'number' => $this->invoice->number]),
            'customer' => $this->whenLoaded('customer', fn () => ['id' => $this->customer->ulid, 'name' => $this->customer->name]),
            'recorded_by' => $this->whenLoaded('recorder', fn () => $this->recorder?->name),
            'confirmed_by' => $this->whenLoaded('confirmer', fn () => $this->confirmer?->name),
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
