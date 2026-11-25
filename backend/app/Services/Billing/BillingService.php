<?php

namespace App\Services\Billing;

use App\Exceptions\FriendlyException;
use App\Models\Billing\CreditNote;
use App\Models\Billing\Customer;
use App\Models\Billing\Invoice;
use App\Models\Billing\Payment;
use App\Models\User;
use App\Services\SettingService;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Every change to invoices, payments and credit notes goes through here, so the rules live in one place:
 * - drafts can change freely; issued documents never change, they are corrected with a credit note or a void
 * - numbers are given at the moment a document becomes official, in order, with no gaps
 * - an invoice's paid, credited and refunded totals are always recalculated from its records
 */
class BillingService
{
    public function __construct(private SettingService $settings, private NumberSequence $numbers) {}

    // ---------------------------------------------------------------- invoices

    /**
     * Create or update a draft.
     *
     * @param  array{customer: Customer, issue_date?: ?string, due_date?: ?string, reference?: ?string, notes?: ?string, terms?: ?string,
     *     lines: array<int, array{description: string, quantity: float|string, unit?: ?string, unit_price: float|string, discount?: float|string|null, tax_rate?: float|string|null}>}  $data
     */
    public function saveDraft(?Invoice $invoice, array $data, User $user): Invoice
    {
        if ($invoice && ! $invoice->isDraft()) {
            throw new FriendlyException('This invoice has been issued, so it can no longer be changed. Use a credit note or void it instead.', 'INVOICE_LOCKED');
        }

        return DB::transaction(function () use ($invoice, $data, $user) {
            $invoice ??= new Invoice(['status' => Invoice::DRAFT, 'created_by' => $user->id, 'currency' => 'MYR']);
            $invoice->fill([
                'customer_id' => $data['customer']->id,
                'issue_date' => $data['issue_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? $this->settings->get('billing', 'invoice_notes'),
                'terms' => $data['terms'] ?? $this->settings->get('billing', 'invoice_terms'),
            ]);
            $invoice->save();

            $invoice->lines()->delete();
            $totals = ['subtotal' => 0, 'discount' => 0, 'tax' => 0];
            $taxEnabled = (bool) $this->settings->get('billing', 'tax_enabled');

            foreach (array_values($data['lines']) as $position => $line) {
                $quantity = round((float) $line['quantity'], 2);
                $price = Money::toSen($line['unit_price']);
                $discount = Money::toSen($line['discount'] ?? 0);
                $gross = (int) round($quantity * $price);
                if ($discount > $gross) {
                    throw new FriendlyException('Line '.($position + 1).': the discount is bigger than the line amount.', 'VALIDATION_FAILED');
                }
                $amount = $gross - $discount;
                $rate = $taxEnabled ? round((float) ($line['tax_rate'] ?? 0), 2) : 0.0;
                $tax = Money::tax($amount, $rate);

                $invoice->lines()->create([
                    'position' => $position,
                    'description' => $line['description'],
                    'quantity' => $quantity,
                    'unit' => $line['unit'] ?? null,
                    'unit_price_sen' => $price,
                    'discount_sen' => $discount,
                    'tax_rate' => $rate,
                    'tax_sen' => $tax,
                    'amount_sen' => $amount,
                ]);

                $totals['subtotal'] += $gross;
                $totals['discount'] += $discount;
                $totals['tax'] += $tax;
            }

            $invoice->forceFill([
                'subtotal_sen' => $totals['subtotal'],
                'discount_sen' => $totals['discount'],
                'tax_sen' => $totals['tax'],
                'total_sen' => $totals['subtotal'] - $totals['discount'] + $totals['tax'],
            ])->save();

            return $invoice->fresh(['lines', 'customer']);
        });
    }

    public function issue(Invoice $invoice, User $user): Invoice
    {
        return DB::transaction(function () use ($invoice, $user) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if (! $invoice->isDraft()) {
                throw new FriendlyException('This invoice has already been issued.', 'INVOICE_LOCKED');
            }
            if (! $invoice->lines()->exists() || $invoice->total_sen <= 0) {
                throw new FriendlyException('Add at least one line with an amount before issuing.', 'INVOICE_EMPTY');
            }

            $issueDate = $invoice->issue_date ? Carbon::parse($invoice->issue_date) : today();
            $dueDate = $invoice->due_date
                ? Carbon::parse($invoice->due_date)
                : $issueDate->copy()->addDays((int) $this->settings->get('billing', 'payment_terms_days', 14));
            if ($dueDate->lt($issueDate)) {
                throw new FriendlyException('The due date is before the invoice date.', 'VALIDATION_FAILED');
            }

            $invoice->forceFill([
                'number' => $this->numbers->next('invoice', $this->settings->get('billing', 'invoice_prefix'), $issueDate),
                'status' => Invoice::ISSUED,
                'issue_date' => $issueDate,
                'due_date' => $dueDate,
                'seller' => $this->sellerSnapshot(),
                'buyer' => $invoice->customer->snapshot(),
                'issued_at' => now(),
                'issued_by' => $user->id,
            ])->save();

            return $invoice->fresh(['lines', 'customer']);
        });
    }

    public function void(Invoice $invoice, string $reason, User $user): Invoice
    {
        return DB::transaction(function () use ($invoice, $reason, $user) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if ($invoice->isDraft()) {
                throw new FriendlyException('Drafts are not official yet, so delete it instead of voiding.', 'INVOICE_DRAFT');
            }
            if ($invoice->status === Invoice::VOID) {
                throw new FriendlyException('This invoice is already void.', 'INVOICE_VOID');
            }
            if ($invoice->payments()->where('status', Payment::CONFIRMED)->exists() || $invoice->creditNotes()->exists()) {
                throw new FriendlyException('This invoice has payments or credit notes, so it can\'t be voided. Issue a credit note instead.', 'INVOICE_HAS_ACTIVITY');
            }

            $invoice->payments()->where('status', Payment::PENDING)->get()
                ->each(fn (Payment $p) => $p->forceFill(['status' => Payment::REJECTED, 'rejected_reason' => 'Invoice voided'])->save());

            $invoice->forceFill([
                'status' => Invoice::VOID,
                'voided_at' => now(),
                'voided_by' => $user->id,
                'void_reason' => $reason,
            ])->save();

            return $invoice->fresh(['lines', 'customer']);
        });
    }

    /** A new draft with the same customer and lines, e.g. for a monthly promotion. */
    public function duplicate(Invoice $invoice, User $user): Invoice
    {
        return $this->saveDraft(null, [
            'customer' => $invoice->customer,
            'reference' => $invoice->reference,
            'notes' => $invoice->notes,
            'terms' => $invoice->terms,
            'lines' => $invoice->lines->map(fn ($line) => [
                'description' => $line->description,
                'quantity' => $line->quantity,
                'unit' => $line->unit,
                'unit_price' => $line->unit_price_sen / 100,
                'discount' => $line->discount_sen / 100,
                'tax_rate' => $line->tax_rate,
            ])->all(),
        ], $user);
    }

    // ---------------------------------------------------------------- payments

    /**
     * @param  array{kind: string, method: string, reference?: ?string, amount: float|string, paid_on: string, notes?: ?string, slip_path?: ?string}  $data
     */
    public function recordPayment(Invoice $invoice, array $data, User $user, bool $confirmNow): Payment
    {
        return DB::transaction(function () use ($invoice, $data, $user, $confirmNow) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            $amount = Money::toSen($data['amount']);
            $this->guardAmount($invoice, $data['kind'], $amount);

            $payment = $invoice->payments()->create([
                'customer_id' => $invoice->customer_id,
                'kind' => $data['kind'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'amount_sen' => $amount,
                'paid_on' => $data['paid_on'],
                'status' => Payment::PENDING,
                'slip_path' => $data['slip_path'] ?? null,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $user->id,
            ]);

            return $confirmNow ? $this->confirm($payment, $user) : $payment;
        });
    }

    public function confirm(Payment $payment, User $user): Payment
    {
        return DB::transaction(function () use ($payment, $user) {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($payment->status !== Payment::PENDING) {
                throw new FriendlyException('This payment has already been checked.', 'PAYMENT_CHECKED');
            }
            $invoice = Invoice::whereKey($payment->invoice_id)->lockForUpdate()->firstOrFail();
            $this->guardAmount($invoice, $payment->kind, $payment->amount_sen);

            $prefix = $this->settings->get('billing', $payment->isRefund() ? 'refund_prefix' : 'receipt_prefix');
            $payment->forceFill([
                'status' => Payment::CONFIRMED,
                'receipt_number' => $this->numbers->next($payment->isRefund() ? 'refund' : 'receipt', $prefix, $payment->paid_on),
                'confirmed_by' => $user->id,
                'confirmed_at' => now(),
            ])->save();

            $this->refreshTotals($invoice);

            return $payment->fresh(['invoice', 'customer']);
        });
    }

    public function reject(Payment $payment, string $reason): Payment
    {
        if ($payment->status !== Payment::PENDING) {
            throw new FriendlyException('This payment has already been checked.', 'PAYMENT_CHECKED');
        }
        $payment->forceFill(['status' => Payment::REJECTED, 'rejected_reason' => $reason])->save();

        return $payment;
    }

    private function guardAmount(Invoice $invoice, string $kind, int $amount): void
    {
        if (in_array($invoice->status, [Invoice::DRAFT, Invoice::VOID], true)) {
            throw new FriendlyException('Payments can only be recorded on issued invoices.', 'INVOICE_NOT_OPEN');
        }
        if ($amount <= 0) {
            throw new FriendlyException('The amount must be more than zero.', 'VALIDATION_FAILED');
        }
        $balance = $invoice->balanceSen();
        if ($kind === Payment::KIND_PAYMENT && $amount > $balance) {
            throw new FriendlyException($balance > 0
                ? 'That is more than the '.Money::format($balance).' still owed on this invoice.'
                : 'Nothing is owed on this invoice.', 'AMOUNT_TOO_HIGH');
        }
        if ($kind === Payment::KIND_REFUND && $amount > max(0, -$balance)) {
            throw new FriendlyException($balance < 0
                ? 'You can refund up to '.Money::format(-$balance).' on this invoice.'
                : 'Nothing needs refunding on this invoice. Issue a credit note first if the customer should get money back.', 'AMOUNT_TOO_HIGH');
        }
    }

    // ---------------------------------------------------------------- credit notes

    /**
     * @param  array{issue_date: string, reason: string, description: string, amount: float|string, tax_rate?: float|string|null}  $data
     */
    public function issueCreditNote(Invoice $invoice, array $data, User $user): CreditNote
    {
        return DB::transaction(function () use ($invoice, $data, $user) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if (in_array($invoice->status, [Invoice::DRAFT, Invoice::VOID], true)) {
                throw new FriendlyException('Credit notes can only be issued against issued invoices.', 'INVOICE_NOT_OPEN');
            }

            $subtotal = Money::toSen($data['amount']);
            $rate = (bool) $this->settings->get('billing', 'tax_enabled') ? round((float) ($data['tax_rate'] ?? 0), 2) : 0.0;
            $tax = Money::tax($subtotal, $rate);
            $total = $subtotal + $tax;
            $room = $invoice->total_sen - $invoice->credited_sen;
            if ($subtotal <= 0) {
                throw new FriendlyException('The amount must be more than zero.', 'VALIDATION_FAILED');
            }
            if ($total > $room) {
                throw new FriendlyException('Credit notes can\'t add up to more than the invoice. Up to '.Money::format($room).' can still be credited.', 'AMOUNT_TOO_HIGH');
            }

            $issueDate = Carbon::parse($data['issue_date']);
            $note = new CreditNote([
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
                'issue_date' => $issueDate,
                'reason' => $data['reason'],
                'description' => $data['description'],
                'subtotal_sen' => $subtotal,
                'tax_rate' => $rate,
                'tax_sen' => $tax,
                'total_sen' => $total,
            ]);
            $note->forceFill([
                'number' => $this->numbers->next('credit_note', $this->settings->get('billing', 'credit_note_prefix'), $issueDate),
                'seller' => $this->sellerSnapshot(),
                'buyer' => $invoice->buyer ?? $invoice->customer->snapshot(),
                'issued_by' => $user->id,
            ])->save();

            $this->refreshTotals($invoice);

            return $note->fresh(['invoice', 'customer']);
        });
    }

    // ---------------------------------------------------------------- shared

    /** Recalculate paid, refunded and credited totals from the records, then the status. */
    public function refreshTotals(Invoice $invoice): Invoice
    {
        $confirmed = $invoice->payments()->where('status', Payment::CONFIRMED);
        $invoice->paid_sen = (int) (clone $confirmed)->where('kind', Payment::KIND_PAYMENT)->sum('amount_sen');
        $invoice->refunded_sen = (int) (clone $confirmed)->where('kind', Payment::KIND_REFUND)->sum('amount_sen');
        $invoice->credited_sen = (int) $invoice->creditNotes()->sum('total_sen');

        if (! in_array($invoice->status, [Invoice::DRAFT, Invoice::VOID], true)) {
            $balance = $invoice->total_sen - $invoice->credited_sen - $invoice->paid_sen + $invoice->refunded_sen;
            $invoice->status = match (true) {
                $balance <= 0 && $invoice->paid_sen > 0 => Invoice::PAID,
                $balance <= 0 => Invoice::CREDITED,
                $invoice->paid_sen > 0 || $invoice->credited_sen > 0 => Invoice::PARTIALLY_PAID,
                default => Invoice::ISSUED,
            };
        }
        $invoice->save();

        return $invoice;
    }

    /** "From" details printed on documents, frozen when each document is issued. */
    public function sellerSnapshot(): array
    {
        $c = $this->settings->group('company');

        return [
            'name' => $c['business_name'],
            'registration_no' => $c['registration_no'],
            'tax_id' => $c['tax_id'],
            'sst_no' => $c['sst_no'],
            'address' => array_values(array_filter(array_map('trim', preg_split('/\r?\n/', (string) $c['address'])))),
            'email' => $c['email'],
            'phone' => $c['phone'],
            'website' => $c['website'],
            'bank' => [
                'name' => $c['bank_name'],
                'account_name' => $c['bank_account_name'],
                'account_no' => $c['bank_account_no'],
            ],
            'tax_label' => $this->settings->get('billing', 'tax_label', 'SST'),
        ];
    }

    /** Next expense number, inside the caller's transaction. */
    public function nextExpenseNumber(Carbon $date): string
    {
        return $this->numbers->next('expense', $this->settings->get('billing', 'expense_prefix'), $date);
    }
}
