<?php

namespace App\Models\Billing;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Someone we bill: a business, an organisation or a person. Later each directory business links to one. */
class Customer extends Model
{
    use HasUlids, LogsActivity, SoftDeletes;

    protected $table = 'billing_customers';

    protected $fillable = ['name', 'registration_no', 'tax_id', 'sst_no', 'contact_person', 'email', 'phone', 'address', 'notes', 'user_id', 'created_by'];

    protected function casts(): array
    {
        return ['address' => 'array'];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The details printed in the "Bill to" box, frozen onto each issued document. */
    public function snapshot(): array
    {
        return [
            'name' => $this->name,
            'registration_no' => $this->registration_no,
            'tax_id' => $this->tax_id,
            'sst_no' => $this->sst_no,
            'contact_person' => $this->contact_person,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->addressLines(),
        ];
    }

    /** @return string[] */
    public function addressLines(): array
    {
        $a = $this->address ?? [];
        $cityLine = trim(implode(' ', array_filter([$a['postcode'] ?? null, $a['city'] ?? null])));

        return array_values(array_filter([
            $a['line1'] ?? null,
            $a['line2'] ?? null,
            $cityLine ?: null,
            trim(implode(', ', array_filter([$a['state'] ?? null, $a['country'] ?? null]))) ?: null,
        ]));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('billing')
            ->logOnly(['name', 'registration_no', 'tax_id', 'sst_no', 'email', 'phone', 'address'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event) => "Customer {$event}");
    }
}
