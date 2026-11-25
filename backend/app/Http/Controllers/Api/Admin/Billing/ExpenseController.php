<?php

namespace App\Http\Controllers\Api\Admin\Billing;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Billing\ExpenseResource;
use App\Models\Billing\Expense;
use App\Models\Billing\Payment;
use App\Services\Billing\BillingService;
use App\Services\SettingService;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

class ExpenseController extends Controller
{
    public function __construct(private BillingService $billing, private SettingService $settings) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $expenses = QueryBuilder::for(Expense::query())
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('number', 'like', "%{$value}%")
                    ->orWhere('payee', 'like', "%{$value}%")
                    ->orWhere('description', 'like', "%{$value}%")
                    ->orWhere('reference', 'like', "%{$value}%"))),
                AllowedFilter::exact('category'),
                AllowedFilter::exact('method'),
                AllowedFilter::callback('spent_from', fn (Builder $q, $value) => $q->whereDate('spent_on', '>=', $value)),
                AllowedFilter::callback('spent_to', fn (Builder $q, $value) => $q->whereDate('spent_on', '<=', $value)),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('spent_on', 'number', 'payee', 'category', AllowedSort::field('total', 'total_sen'))
            ->defaultSort('-spent_on')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return ExpenseResource::collection($expenses);
    }

    public function show(Expense $expense): ExpenseResource
    {
        return new ExpenseResource($expense->load('recorder'));
    }

    /** Sent as multipart form data so the supplier's bill can be attached. */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $expense = DB::transaction(function () use ($data, $request) {
            $expense = new Expense($this->values($data) + ['recorded_by' => $request->user()->id]);
            $expense->forceFill(['number' => $this->billing->nextExpenseNumber(Carbon::parse($data['spent_on']))]);
            $expense->save();

            return $expense;
        });
        $this->storeAttachment($request, $expense);

        return response()->json(['message' => "Expense {$expense->number} of ".Money::format($expense->total_sen).' recorded.', 'data' => new ExpenseResource($expense)], 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $data = $this->validated($request);
        $expense->update($this->values($data));
        if ($request->boolean('remove_attachment') && $expense->attachment_path) {
            Storage::disk('local')->delete($expense->attachment_path);
            $expense->update(['attachment_path' => null]);
        }
        $this->storeAttachment($request, $expense);

        return response()->json(['message' => "Changes to {$expense->number} are saved.", 'data' => new ExpenseResource($expense->fresh())]);
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $expense->delete();

        return response()->json(['message' => "{$expense->number} moved to the bin. It no longer counts in reports."]);
    }

    public function restore(Expense $expense): JsonResponse
    {
        $expense->restore();

        return response()->json(['message' => "{$expense->number} restored."]);
    }

    public function attachment(Expense $expense): Response
    {
        if (! $expense->attachment_path || ! Storage::disk('local')->exists($expense->attachment_path)) {
            throw new FriendlyException('There is no bill attached to this expense.', 'NOT_FOUND', 404);
        }

        return Storage::disk('local')->download($expense->attachment_path);
    }

    private function validated(Request $request): array
    {
        $categories = $this->settings->get('billing', 'expense_categories', []);

        return $request->validate([
            'spent_on' => ['required', 'date', 'before_or_equal:today'],
            'category' => ['required', 'string', Rule::in($categories)],
            'payee' => ['required', 'string', 'max:190'],
            'description' => ['required', 'string', 'max:500'],
            'reference' => ['nullable', 'string', 'max:120'],
            'method' => ['required', Rule::in(array_keys(Payment::METHODS))],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'tax' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:8192'],
        ], [
            'payee.required' => 'Please say who was paid.',
            'category.in' => 'Please choose one of the expense categories.',
            'spent_on.before_or_equal' => 'The date can\'t be in the future.',
            'attachment.mimes' => 'The bill must be a PDF or a photo (JPG, PNG or WebP).',
            'attachment.max' => 'The bill must be smaller than 8 MB.',
        ]);
    }

    private function values(array $data): array
    {
        $amount = Money::toSen($data['amount']);
        $tax = Money::toSen($data['tax'] ?? 0);

        return [
            'spent_on' => $data['spent_on'],
            'category' => $data['category'],
            'payee' => $data['payee'],
            'description' => $data['description'],
            'reference' => $data['reference'] ?? null,
            'method' => $data['method'],
            'amount_sen' => $amount,
            'tax_sen' => $tax,
            'total_sen' => $amount + $tax,
            'notes' => $data['notes'] ?? null,
        ];
    }

    /** Bills are private: kept on the local disk, only downloadable by staff with billing access. */
    private function storeAttachment(Request $request, Expense $expense): void
    {
        if (! $request->hasFile('attachment')) {
            return;
        }
        if ($expense->attachment_path) {
            Storage::disk('local')->delete($expense->attachment_path);
        }
        $file = $request->file('attachment');
        $path = $file->storeAs('billing/expenses/'.$expense->spent_on->format('Y'), $expense->number.'.'.$file->extension(), 'local');
        $expense->update(['attachment_path' => $path]);
    }
}
