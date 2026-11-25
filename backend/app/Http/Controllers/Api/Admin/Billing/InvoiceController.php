<?php

namespace App\Http\Controllers\Api\Admin\Billing;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Billing\CreditNoteResource;
use App\Http\Resources\Billing\InvoiceResource;
use App\Http\Resources\Billing\PaymentResource;
use App\Models\Billing\Customer;
use App\Models\Billing\Invoice;
use App\Models\Billing\Payment;
use App\Services\Billing\BillingService;
use App\Services\Billing\DocumentService;
use App\Services\SettingService;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

class InvoiceController extends Controller
{
    public function __construct(private BillingService $billing) {}

    /** GET /admin/billing/invoices?filter[q]=&filter[status]=&filter[overdue]=yes&filter[customer]=&filter[issued_from]=&sort=-issue_date */
    public function index(Request $request): AnonymousResourceCollection
    {
        $invoices = QueryBuilder::for(Invoice::query()->with('customer'))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('number', 'like', "%{$value}%")
                    ->orWhere('reference', 'like', "%{$value}%")
                    ->orWhereHas('customer', fn (Builder $c) => $c->withTrashed()->where('name', 'like', "%{$value}%")))),
                AllowedFilter::callback('status', fn (Builder $q, $value) => $value === 'open'
                    ? $q->whereIn('status', Invoice::OPEN)
                    : $q->whereIn('status', (array) $value)),
                AllowedFilter::callback('overdue', fn (Builder $q, $value) => $value === 'yes' ? $q->overdue() : $q),
                AllowedFilter::callback('customer', fn (Builder $q, $value) => $q->whereHas('customer', fn (Builder $c) => $c->withTrashed()->where('ulid', $value))),
                AllowedFilter::callback('issued_from', fn (Builder $q, $value) => $q->whereDate('issue_date', '>=', $value)),
                AllowedFilter::callback('issued_to', fn (Builder $q, $value) => $q->whereDate('issue_date', '<=', $value)),
            )
            ->allowedSorts(
                'number', 'issue_date', 'due_date', 'created_at',
                AllowedSort::field('total', 'total_sen'),
                AllowedSort::callback('balance', fn (Builder $q, bool $descending) => $q->orderByRaw(
                    "CASE WHEN status IN ('draft','void') THEN 0 ELSE total_sen - credited_sen - paid_sen + refunded_sen END ".($descending ? 'DESC' : 'ASC'))),
            )
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return InvoiceResource::collection($invoices);
    }

    /** What the billing screens need to know: tax switched on or not, payment terms, expense categories. */
    public function config(SettingService $settings): JsonResponse
    {
        $billing = $settings->group('billing');
        $company = $settings->group('company');

        return response()->json(['data' => [
            'tax_enabled' => (bool) $billing['tax_enabled'],
            'tax_label' => $billing['tax_label'],
            'default_tax_rate' => (float) $billing['default_tax_rate'],
            'payment_terms_days' => (int) $billing['payment_terms_days'],
            'expense_categories' => array_values($billing['expense_categories']),
            'company_ready' => filled($company['bank_account_no']) && filled($company['address']),
        ]]);
    }

    /** Numbers for the top of the invoices page. */
    public function summary(): JsonResponse
    {
        $open = Invoice::whereIn('status', Invoice::OPEN)->get();
        $monthStart = today()->startOfMonth()->toDateString();

        return response()->json(['data' => [
            'outstanding_sen' => $open->sum(fn (Invoice $i) => max(0, $i->balanceSen())),
            'overdue_sen' => $open->filter->isOverdue()->sum(fn (Invoice $i) => max(0, $i->balanceSen())),
            'overdue_count' => $open->filter->isOverdue()->count(),
            'drafts' => Invoice::where('status', Invoice::DRAFT)->count(),
            'received_this_month_sen' => (int) Payment::where('status', Payment::CONFIRMED)->where('kind', Payment::KIND_PAYMENT)
                ->where('paid_on', '>=', $monthStart)->sum('amount_sen'),
            'pending_payments' => Payment::where('status', Payment::PENDING)->count(),
        ]]);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        return new InvoiceResource($invoice->load(['customer', 'lines', 'payments.recorder', 'payments.confirmer', 'creditNotes.issuer', 'issuer', 'creator']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $invoice = $this->billing->saveDraft(null, $data, $request->user());
        $message = 'Draft invoice saved.';

        if ($request->boolean('issue')) {
            $invoice = $this->billing->issue($invoice, $request->user());
            $message = "Invoice {$invoice->number} issued.";
        }

        return response()->json(['message' => $message, 'data' => new InvoiceResource($invoice->load('customer'))], 201);
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $this->validated($request);
        $invoice = $this->billing->saveDraft($invoice, $data, $request->user());
        $message = 'Draft invoice saved.';

        if ($request->boolean('issue')) {
            $invoice = $this->billing->issue($invoice, $request->user());
            $message = "Invoice {$invoice->number} issued.";
        }

        return response()->json(['message' => $message, 'data' => new InvoiceResource($invoice->load('customer'))]);
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        if (! $invoice->isDraft()) {
            throw new FriendlyException('Issued invoices are kept for the records. Void it instead.', 'INVOICE_LOCKED');
        }
        $invoice->delete();

        return response()->json(['message' => 'Draft deleted.']);
    }

    public function issue(Request $request, Invoice $invoice): JsonResponse
    {
        $invoice = $this->billing->issue($invoice, $request->user());

        return response()->json(['message' => "Invoice {$invoice->number} issued. It can no longer be edited.", 'data' => new InvoiceResource($invoice)]);
    }

    public function void(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Please say why this invoice is being voided.']);
        $invoice = $this->billing->void($invoice, $data['reason'], $request->user());

        return response()->json(['message' => "Invoice {$invoice->number} is void. It stays in the records.", 'data' => new InvoiceResource($invoice)]);
    }

    public function duplicate(Request $request, Invoice $invoice): JsonResponse
    {
        $copy = $this->billing->duplicate($invoice->load(['lines', 'customer']), $request->user());

        return response()->json(['message' => 'A new draft has been made from '.$invoice->displayNumber().'.', 'data' => new InvoiceResource($copy)], 201);
    }

    public function pdf(Invoice $invoice, DocumentService $documents): Response
    {
        $name = $invoice->number ?? 'draft-invoice-'.$invoice->ulid;

        return $documents->invoice($invoice)->download($documents->filename($name, 'pdf'));
    }

    /** POST /admin/billing/invoices/{id}/payments: record money received or a refund paid. */
    public function recordPayment(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in([Payment::KIND_PAYMENT, Payment::KIND_REFUND])],
            'method' => ['required', Rule::in(array_keys(Payment::METHODS))],
            'reference' => ['nullable', 'string', 'max:120'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'confirm' => ['boolean'],
        ], [
            'amount.min' => 'The amount must be more than zero.',
            'paid_on.before_or_equal' => 'The payment date can\'t be in the future.',
        ]);

        $confirm = ($data['confirm'] ?? false) && $request->user()->can('billing.approve');
        $payment = $this->billing->recordPayment($invoice, $data, $request->user(), $confirm);
        $what = $payment->isRefund() ? 'Refund' : 'Payment';
        $message = $payment->status === Payment::CONFIRMED
            ? "{$what} of ".Money::format($payment->amount_sen)." recorded. {$payment->receipt_number} is ready to print."
            : "{$what} of ".Money::format($payment->amount_sen).' recorded. It will count once someone with approval rights confirms it.';

        return response()->json(['message' => $message, 'data' => new PaymentResource($payment)], 201);
    }

    /** POST /admin/billing/invoices/{id}/credit-notes */
    public function issueCreditNote(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate([
            'issue_date' => ['required', 'date', 'before_or_equal:today'],
            'reason' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:500'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [
            'reason.required' => 'Please give the reason for this credit note.',
            'description.required' => 'Please describe what is being credited.',
        ]);

        $note = $this->billing->issueCreditNote($invoice, $data, $request->user());

        return response()->json(['message' => "Credit note {$note->number} issued for ".Money::format($note->total_sen).'.', 'data' => new CreditNoteResource($note)], 201);
    }

    /** POST /admin/billing/invoices/bulk { action: delete_drafts, ids[] } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['delete_drafts', 'issue_drafts'])],
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['string'],
        ]);

        $invoices = Invoice::whereIn('ulid', $data['ids'])->where('status', Invoice::DRAFT)->orderBy('created_at')->get();
        $done = 0;
        DB::transaction(function () use ($invoices, $data, $request, &$done) {
            foreach ($invoices as $invoice) {
                $data['action'] === 'delete_drafts' ? $invoice->delete() : $this->billing->issue($invoice, $request->user());
                $done++;
            }
        });
        $skipped = count($data['ids']) - $done;
        $verb = $data['action'] === 'delete_drafts' ? 'deleted' : 'issued';
        $message = ($done === 1 ? '1 draft ' : "{$done} drafts ").$verb.'.'.($skipped ? " {$skipped} skipped because they are already issued." : '');

        return response()->json(['message' => $message, 'affected' => $done, 'skipped' => $skipped]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'customer_id' => ['required', 'string'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'terms' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.description' => ['required', 'string', 'max:500'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.01', 'max:999999'],
            'lines.*.unit' => ['nullable', 'string', 'max:20'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'max:99999999'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'issue' => ['boolean'],
        ], [
            'customer_id.required' => 'Please choose who this invoice is for.',
            'lines.required' => 'Add at least one line.',
            'lines.min' => 'Add at least one line.',
            'lines.*.description.required' => 'Each line needs a description.',
            'lines.*.quantity.min' => 'Quantity must be more than zero.',
            'due_date.after_or_equal' => 'The due date can\'t be before the invoice date.',
        ]);

        $data['customer'] = Customer::where('ulid', $data['customer_id'])->first()
            ?? throw new FriendlyException('That customer could not be found. They may have been archived.', 'VALIDATION_FAILED');

        return $data;
    }
}
