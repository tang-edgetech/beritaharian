<?php

namespace App\Http\Controllers\Api\Admin\Billing;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Billing\CustomerResource;
use App\Models\Billing\Customer;
use App\Models\Billing\Invoice;
use App\Services\Billing\DocumentService;
use App\Services\Billing\ReportService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

class CustomerController extends Controller
{
    /** GET /admin/billing/customers?filter[q]=&filter[owing]=yes&filter[trashed]=with&sort=-balance */
    public function index(Request $request): AnonymousResourceCollection
    {
        $customers = QueryBuilder::for($this->withBalance(Customer::query())->withCount('invoices'))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('name', 'like', "%{$value}%")
                    ->orWhere('email', 'like', "%{$value}%")
                    ->orWhere('registration_no', 'like', "%{$value}%")
                    ->orWhere('phone', 'like', "%{$value}%"))),
                AllowedFilter::callback('owing', fn (Builder $q, $value) => $value === 'yes'
                    ? $q->having('balance_sen', '>', 0)
                    : $q->having('balance_sen', '<=', 0)),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('name', 'created_at', AllowedSort::field('balance', 'balance_sen'), AllowedSort::field('invoices', 'invoices_count'))
            ->defaultSort('name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return CustomerResource::collection($customers);
    }

    /** Short list for the customer picker on the invoice form. */
    public function options(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q'));
        $customers = Customer::query()
            ->when($q !== '', fn (Builder $b) => $b->where('name', 'like', "%{$q}%")->orWhere('registration_no', 'like', "%{$q}%"))
            ->orderBy('name')->limit(20)->get(['ulid', 'name', 'email', 'registration_no']);

        return response()->json(['data' => $customers->map(fn ($c) => [
            'id' => $c->ulid, 'name' => $c->name, 'email' => $c->email, 'registration_no' => $c->registration_no,
        ])]);
    }

    public function show(Customer $customer): CustomerResource
    {
        return new CustomerResource($this->withBalance(Customer::withTrashed()->whereKey($customer->id))->withCount('invoices')->firstOrFail());
    }

    public function store(Request $request): JsonResponse
    {
        $customer = Customer::create($this->validated($request) + ['created_by' => $request->user()->id]);

        return response()->json(['message' => "{$customer->name} has been added.", 'data' => new CustomerResource($customer)], 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $customer->update($this->validated($request));

        return response()->json([
            'message' => "Changes to {$customer->name} are saved. Invoices already issued keep the details they were issued with.",
            'data' => new CustomerResource($customer),
        ]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $owing = $customer->invoices()->whereIn('status', Invoice::OPEN)->exists();
        if ($owing) {
            throw new FriendlyException("{$customer->name} still has unpaid invoices, so they can't be archived yet.", 'CUSTOMER_OWING');
        }
        $customer->delete();

        return response()->json(['message' => "{$customer->name} is archived. Their invoices stay in the records."]);
    }

    public function restore(Customer $customer): JsonResponse
    {
        $customer->restore();

        return response()->json(['message' => "{$customer->name} is back in the customer list."]);
    }

    /** GET /admin/billing/customers/{id}/statement?from=&to=&format=json|pdf|csv */
    public function statement(Request $request, Customer $customer, ReportService $reports, DocumentService $documents): JsonResponse|Response
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'format' => ['nullable', 'in:json,pdf,csv'],
        ], ['to.after_or_equal' => 'The end date must be on or after the start date.']);

        $report = $reports->statement($customer, Carbon::parse($data['from']), Carbon::parse($data['to']));
        $name = "statement {$customer->name} {$data['from']} to {$data['to']}";

        return match ($data['format'] ?? 'json') {
            'pdf' => $documents->report($report)->download($documents->filename($name, 'pdf')),
            'csv' => $documents->reportCsv($report, $documents->filename($name, 'csv')),
            default => response()->json(['data' => $report]),
        };
    }

    /** Adds balance_sen: what the customer owes across issued, unpaid invoices. */
    private function withBalance(Builder $query): Builder
    {
        $owed = Invoice::query()
            ->selectRaw('COALESCE(SUM(total_sen - credited_sen - paid_sen + refunded_sen), 0)')
            ->whereColumn('invoices.customer_id', 'billing_customers.id')
            ->whereNotIn('status', [Invoice::DRAFT, Invoice::VOID]);

        return $query->select('billing_customers.*')->selectSub($owed, 'balance_sen');
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:190'],
            'registration_no' => ['nullable', 'string', 'max:60'],
            'tax_id' => ['nullable', 'string', 'max:40'],
            'sst_no' => ['nullable', 'string', 'max:40'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email:rfc', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'array'],
            'address.line1' => ['nullable', 'string', 'max:190'],
            'address.line2' => ['nullable', 'string', 'max:190'],
            'address.postcode' => ['nullable', 'string', 'max:10'],
            'address.city' => ['nullable', 'string', 'max:80'],
            'address.state' => ['nullable', 'string', 'max:80'],
            'address.country' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], ['name.required' => 'Please enter the customer\'s name.']);

        return $data;
    }
}
