<?php

namespace App\Http\Resources\Billing;

use App\Models\Billing\Expense;
use App\Models\Billing\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Expense */
class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'number' => $this->number,
            'spent_on' => $this->spent_on?->toDateString(),
            'category' => $this->category,
            'payee' => $this->payee,
            'description' => $this->description,
            'reference' => $this->reference,
            'method' => $this->method,
            'method_label' => Payment::METHODS[$this->method] ?? $this->method,
            'amount_sen' => $this->amount_sen,
            'tax_sen' => $this->tax_sen,
            'total_sen' => $this->total_sen,
            'has_attachment' => (bool) $this->attachment_path,
            'attachment_name' => $this->attachment_path ? basename($this->attachment_path) : null,
            'notes' => $this->notes,
            'recorded_by' => $this->whenLoaded('recorder', fn () => $this->recorder?->name),
            'created_at' => $this->created_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
