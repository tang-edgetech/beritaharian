<?php

namespace App\Http\Controllers\Api\Admin\Billing;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Billing\PaymentResource;
use App\Models\Billing\Payment;
use App\Services\Billing\BillingService;
use App\Services\Billing\DocumentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class PaymentController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $payments = QueryBuilder::for(Payment::query()->with(['invoice', 'customer']))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('receipt_number', 'like', "%{$value}%")
                    ->orWhere('reference', 'like', "%{$value}%")
                    ->orWhereHas('invoice', fn (Builder $i) => $i->where('number', 'like', "%{$value}%"))
                    ->orWhereHas('customer', fn (Builder $c) => $c->withTrashed()->where('name', 'like', "%{$value}%")))),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('kind'),
                AllowedFilter::exact('method'),
                AllowedFilter::callback('paid_from', fn (Builder $q, $value) => $q->whereDate('paid_on', '>=', $value)),
                AllowedFilter::callback('paid_to', fn (Builder $q, $value) => $q->whereDate('paid_on', '<=', $value)),
            )
            ->allowedSorts('paid_on', 'receipt_number', 'created_at', AllowedSort::field('amount', 'amount_sen'))
            ->defaultSort('-paid_on')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return PaymentResource::collection($payments);
    }

    public function show(Payment $payment): PaymentResource
    {
        return new PaymentResource($payment->load(['invoice', 'customer', 'recorder', 'confirmer']));
    }

    public function confirm(Request $request, Payment $payment): JsonResponse
    {
        $payment = $this->billing->confirm($payment, $request->user());

        return response()->json(['message' => "Confirmed. {$payment->receipt_number} is ready to print.", 'data' => new PaymentResource($payment)]);
    }

    public function reject(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Please say why this payment is rejected.']);
        $payment = $this->billing->reject($payment, $data['reason']);

        return response()->json(['message' => 'Payment rejected. It does not count towards the invoice.', 'data' => new PaymentResource($payment)]);
    }

    /** POST /admin/billing/payments/bulk { action: confirm, ids[] } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['confirm'])],
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['string'],
        ]);

        $done = 0;
        $problems = [];
        foreach (Payment::whereIn('ulid', $data['ids'])->where('status', Payment::PENDING)->orderBy('paid_on')->get() as $payment) {
            try {
                $this->billing->confirm($payment, $request->user());
                $done++;
            } catch (FriendlyException $e) {
                $problems[] = $e->getMessage();
            } catch (Throwable $e) {
                report($e);
                $problems[] = 'One payment could not be confirmed.';
            }
        }
        $skipped = count($data['ids']) - $done;
        $message = ($done === 1 ? '1 payment confirmed.' : "{$done} payments confirmed.")
            .($skipped ? " {$skipped} skipped (already checked, or more than the amount owed)." : '');

        return response()->json(['message' => $message, 'affected' => $done, 'skipped' => $skipped, 'problems' => $problems]);
    }

    public function receipt(Payment $payment, DocumentService $documents): Response
    {
        if ($payment->status !== Payment::CONFIRMED) {
            throw new FriendlyException('A receipt is only available once the payment is confirmed.', 'PAYMENT_NOT_CONFIRMED');
        }

        return $documents->receipt($payment)->download($documents->filename($payment->receipt_number, 'pdf'));
    }

    public function slip(Payment $payment): Response
    {
        if (! $payment->slip_path || ! Storage::disk('local')->exists($payment->slip_path)) {
            throw new FriendlyException('There is no transfer slip for this payment.', 'NOT_FOUND', 404);
        }

        return Storage::disk('local')->download($payment->slip_path);
    }
}
