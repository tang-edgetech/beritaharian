<?php

namespace App\Http\Resources\Billing;

use App\Models\Billing\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Customer */
class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'name' => $this->name,
            'registration_no' => $this->registration_no,
            'tax_id' => $this->tax_id,
            'sst_no' => $this->sst_no,
            'contact_person' => $this->contact_person,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => array_merge(
                ['line1' => null, 'line2' => null, 'postcode' => null, 'city' => null, 'state' => 'Melaka', 'country' => 'Malaysia'],
                $this->address ?? [],
            ),
            'address_lines' => $this->addressLines(),
            'notes' => $this->notes,
            'invoices_count' => $this->whenCounted('invoices'),
            'balance_sen' => $this->when(isset($this->balance_sen), fn () => (int) $this->balance_sen),
            'created_at' => $this->created_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
