<?php

namespace App\Services\Billing;

use App\Exceptions\FriendlyException;
use App\Models\Billing\CreditNote;
use App\Models\Billing\Customer;
use App\Models\Billing\Expense;
use App\Models\Billing\Invoice;
use App\Models\Billing\Payment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Builds every finance report in one shape, so the admin screen, the PDF and the CSV all print the same thing:
 * [ key, title, period, summary: [{label, value, type}], tables: [{title, columns, rows, totals}] ]
 * Money is whole sen; columns say how to print each value (text, date, money, number).
 */
class ReportService
{
    public const TYPES = [
        'sales' => 'Sales',
        'collections' => 'Money received and refunded',
        'outstanding' => 'Outstanding invoices',
        'income-expenses' => 'Income and expenses',
        'expenses' => 'Expenses',
        'tax' => 'Tax charged',
    ];

    public function build(string $type, Carbon $from, Carbon $to): array
    {
        if ($from->gt($to)) {
            throw new FriendlyException('The start date is after the end date.', 'VALIDATION_FAILED');
        }

        return match ($type) {
            'sales' => $this->sales($from, $to),
            'collections' => $this->collections($from, $to),
            'outstanding' => $this->outstanding(),
            'income-expenses' => $this->incomeExpenses($from, $to),
            'expenses' => $this->expenses($from, $to),
            'tax' => $this->tax($from, $to),
            default => throw new FriendlyException("We couldn't find that report.", 'NOT_FOUND', 404),
        };
    }

    private function sales(Carbon $from, Carbon $to): array
    {
        $invoices = Invoice::counted()->with('customer')
            ->whereDate('issue_date', '>=', $from)->whereDate('issue_date', '<=', $to)
            ->orderBy('issue_date')->orderBy('number')->get();

        $rows = $invoices->map(fn (Invoice $i) => [
            'date' => $i->issue_date->toDateString(),
            'number' => $i->number,
            'customer' => $i->buyer['name'] ?? $i->customer->name,
            'status' => $this->statusLabel($i->status),
            'subtotal' => $i->subtotal_sen - $i->discount_sen,
            'tax' => $i->tax_sen,
            'total' => $i->total_sen,
            'credited' => $i->credited_sen,
            'paid' => $i->paid_sen - $i->refunded_sen,
            'balance' => $i->balanceSen(),
        ]);

        $totals = $this->sum($rows, ['subtotal', 'tax', 'total', 'credited', 'paid', 'balance']);

        return $this->report('sales', $from, $to, [
            ['label' => 'Invoices issued', 'value' => $rows->count(), 'type' => 'number'],
            ['label' => 'Total invoiced', 'value' => $totals['total'], 'type' => 'money'],
            ['label' => 'Credited', 'value' => $totals['credited'], 'type' => 'money'],
            ['label' => 'Still owed', 'value' => $totals['balance'], 'type' => 'money'],
        ], [[
            'title' => 'Invoices issued',
            'columns' => [
                $this->col('date', 'Date', 'date'), $this->col('number', 'Invoice no.'), $this->col('customer', 'Customer'),
                $this->col('status', 'Status'), $this->col('subtotal', 'Before tax', 'money'), $this->col('tax', 'Tax', 'money'),
                $this->col('total', 'Total', 'money'), $this->col('credited', 'Credited', 'money'), $this->col('paid', 'Paid', 'money'),
                $this->col('balance', 'Balance', 'money'),
            ],
            'rows' => $rows->all(),
            'totals' => $totals,
        ]]);
    }

    private function collections(Carbon $from, Carbon $to): array
    {
        $payments = Payment::with(['invoice', 'customer'])->where('status', Payment::CONFIRMED)
            ->whereDate('paid_on', '>=', $from)->whereDate('paid_on', '<=', $to)
            ->orderBy('paid_on')->orderBy('receipt_number')->get();

        $rows = $payments->map(fn (Payment $p) => [
            'date' => $p->paid_on->toDateString(),
            'receipt' => $p->receipt_number,
            'invoice' => $p->invoice->number,
            'customer' => $p->customer->name,
            'method' => $p->methodLabel(),
            'reference' => $p->reference,
            'in' => $p->isRefund() ? 0 : $p->amount_sen,
            'out' => $p->isRefund() ? $p->amount_sen : 0,
        ]);
        $totals = $this->sum($rows, ['in', 'out']);

        $byMethod = $payments->groupBy(fn (Payment $p) => $p->methodLabel())->map(fn (Collection $group, $method) => [
            'method' => $method,
            'count' => $group->count(),
            'in' => $group->reject->isRefund()->sum('amount_sen'),
            'out' => $group->filter->isRefund()->sum('amount_sen'),
        ])->values();

        return $this->report('collections', $from, $to, [
            ['label' => 'Received', 'value' => $totals['in'], 'type' => 'money'],
            ['label' => 'Refunded', 'value' => $totals['out'], 'type' => 'money'],
            ['label' => 'Net received', 'value' => $totals['in'] - $totals['out'], 'type' => 'money'],
        ], [
            [
                'title' => 'Receipts and refunds',
                'columns' => [
                    $this->col('date', 'Date', 'date'), $this->col('receipt', 'Receipt no.'), $this->col('invoice', 'Invoice no.'),
                    $this->col('customer', 'Customer'), $this->col('method', 'Method'), $this->col('reference', 'Reference'),
                    $this->col('in', 'Money in', 'money'), $this->col('out', 'Money out', 'money'),
                ],
                'rows' => $rows->all(),
                'totals' => $totals,
            ],
            [
                'title' => 'By payment method',
                'columns' => [$this->col('method', 'Method'), $this->col('count', 'Count', 'number'), $this->col('in', 'Money in', 'money'), $this->col('out', 'Money out', 'money')],
                'rows' => $byMethod->all(),
                'totals' => $this->sum($byMethod, ['count', 'in', 'out']),
            ],
        ]);
    }

    /** Always as of today: what each customer still owes, grouped by how late it is. */
    private function outstanding(): array
    {
        $today = today();
        $invoices = Invoice::with('customer')->whereIn('status', Invoice::OPEN)->orderBy('due_date')->get()
            ->filter(fn (Invoice $i) => $i->balanceSen() > 0);

        $bucket = function (Invoice $i) use ($today): string {
            $late = $i->due_date->lt($today) ? (int) $i->due_date->diffInDays($today) : 0;

            return match (true) {
                $late === 0 => 'Not due yet',
                $late <= 30 => '1–30 days late',
                $late <= 60 => '31–60 days late',
                $late <= 90 => '61–90 days late',
                default => 'Over 90 days late',
            };
        };

        $rows = $invoices->map(fn (Invoice $i) => [
            'number' => $i->number,
            'customer' => $i->buyer['name'] ?? $i->customer->name,
            'date' => $i->issue_date->toDateString(),
            'due' => $i->due_date->toDateString(),
            'days_late' => $i->due_date->lt($today) ? (int) $i->due_date->diffInDays($today) : 0,
            'total' => $i->total_sen,
            'balance' => $i->balanceSen(),
            'age' => $bucket($i),
        ])->values();

        $order = ['Not due yet', '1–30 days late', '31–60 days late', '61–90 days late', 'Over 90 days late'];
        $aging = collect($order)->map(fn ($label) => [
            'age' => $label,
            'count' => $rows->where('age', $label)->count(),
            'balance' => $rows->where('age', $label)->sum('balance'),
        ]);

        $byCustomer = $rows->groupBy('customer')->map(fn (Collection $g, $name) => [
            'customer' => $name, 'count' => $g->count(), 'balance' => $g->sum('balance'),
        ])->sortByDesc('balance')->values();

        return $this->report('outstanding', $today, $today, [
            ['label' => 'Invoices unpaid', 'value' => $rows->count(), 'type' => 'number'],
            ['label' => 'Total owed', 'value' => $rows->sum('balance'), 'type' => 'money'],
            ['label' => 'Overdue', 'value' => $rows->where('days_late', '>', 0)->sum('balance'), 'type' => 'money'],
        ], [
            [
                'title' => 'By how late',
                'columns' => [$this->col('age', 'Age'), $this->col('count', 'Invoices', 'number'), $this->col('balance', 'Owed', 'money')],
                'rows' => $aging->all(),
                'totals' => $this->sum($aging, ['count', 'balance']),
            ],
            [
                'title' => 'By customer',
                'columns' => [$this->col('customer', 'Customer'), $this->col('count', 'Invoices', 'number'), $this->col('balance', 'Owed', 'money')],
                'rows' => $byCustomer->all(),
                'totals' => $this->sum($byCustomer, ['count', 'balance']),
            ],
            [
                'title' => 'Unpaid invoices',
                'columns' => [
                    $this->col('number', 'Invoice no.'), $this->col('customer', 'Customer'), $this->col('date', 'Invoice date', 'date'),
                    $this->col('due', 'Due date', 'date'), $this->col('days_late', 'Days late', 'number'),
                    $this->col('total', 'Total', 'money'), $this->col('balance', 'Owed', 'money'),
                ],
                'rows' => $rows->map(fn ($r) => collect($r)->except('age')->all())->all(),
                'totals' => $this->sum($rows, ['total', 'balance']),
            ],
        ], 'As of '.$today->format('j M Y'));
    }

    /** Cash basis: money actually received and spent in each month. */
    private function incomeExpenses(Carbon $from, Carbon $to): array
    {
        $range = [$from->toDateString(), $to->toDateString()];
        $payments = Payment::where('status', Payment::CONFIRMED)->whereDate('paid_on', '>=', $from)->whereDate('paid_on', '<=', $to)->get();
        $expenses = Expense::whereDate('spent_on', '>=', $from)->whereDate('spent_on', '<=', $to)->get();

        $months = collect();
        for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonth()) {
            $key = $m->format('Y-m');
            $in = $payments->filter(fn ($p) => $p->paid_on->format('Y-m') === $key);
            $spent = $expenses->filter(fn ($e) => $e->spent_on->format('Y-m') === $key);
            $income = $in->reject->isRefund()->sum('amount_sen') - $in->filter->isRefund()->sum('amount_sen');
            $cost = $spent->sum('total_sen');
            $months->push(['month' => $m->format('M Y'), 'income' => $income, 'expenses' => $cost, 'net' => $income - $cost]);
        }

        $byCategory = $expenses->groupBy('category')->map(fn (Collection $g, $category) => [
            'category' => $category, 'count' => $g->count(), 'total' => $g->sum('total_sen'),
        ])->sortByDesc('total')->values();

        $totals = $this->sum($months, ['income', 'expenses', 'net']);

        return $this->report('income-expenses', $from, $to, [
            ['label' => 'Money in (after refunds)', 'value' => $totals['income'], 'type' => 'money'],
            ['label' => 'Expenses', 'value' => $totals['expenses'], 'type' => 'money'],
            ['label' => $totals['net'] >= 0 ? 'Surplus' : 'Shortfall', 'value' => $totals['net'], 'type' => 'money'],
        ], [
            [
                'title' => 'By month',
                'columns' => [$this->col('month', 'Month'), $this->col('income', 'Money in', 'money'), $this->col('expenses', 'Expenses', 'money'), $this->col('net', 'Net', 'money')],
                'rows' => $months->all(),
                'totals' => $totals,
            ],
            [
                'title' => 'Expenses by category',
                'columns' => [$this->col('category', 'Category'), $this->col('count', 'Items', 'number'), $this->col('total', 'Total', 'money')],
                'rows' => $byCategory->all(),
                'totals' => $this->sum($byCategory, ['count', 'total']),
            ],
        ], null, 'Cash basis: counts money when it is actually received or spent, not when invoiced.');
    }

    private function expenses(Carbon $from, Carbon $to): array
    {
        $expenses = Expense::whereDate('spent_on', '>=', $from)->whereDate('spent_on', '<=', $to)
            ->orderBy('spent_on')->orderBy('number')->get();

        $rows = $expenses->map(fn (Expense $e) => [
            'date' => $e->spent_on->toDateString(),
            'number' => $e->number,
            'category' => $e->category,
            'payee' => $e->payee,
            'description' => $e->description,
            'reference' => $e->reference,
            'amount' => $e->amount_sen,
            'tax' => $e->tax_sen,
            'total' => $e->total_sen,
        ]);
        $byCategory = $expenses->groupBy('category')->map(fn (Collection $g, $category) => [
            'category' => $category, 'count' => $g->count(), 'total' => $g->sum('total_sen'),
        ])->sortByDesc('total')->values();

        return $this->report('expenses', $from, $to, [
            ['label' => 'Items', 'value' => $rows->count(), 'type' => 'number'],
            ['label' => 'Total spent', 'value' => $rows->sum('total'), 'type' => 'money'],
        ], [
            [
                'title' => 'By category',
                'columns' => [$this->col('category', 'Category'), $this->col('count', 'Items', 'number'), $this->col('total', 'Total', 'money')],
                'rows' => $byCategory->all(),
                'totals' => $this->sum($byCategory, ['count', 'total']),
            ],
            [
                'title' => 'All expenses',
                'columns' => [
                    $this->col('date', 'Date', 'date'), $this->col('number', 'Expense no.'), $this->col('category', 'Category'),
                    $this->col('payee', 'Paid to'), $this->col('description', 'Description'), $this->col('reference', 'Bill no.'),
                    $this->col('amount', 'Before tax', 'money'), $this->col('tax', 'Tax', 'money'), $this->col('total', 'Total', 'money'),
                ],
                'rows' => $rows->all(),
                'totals' => $this->sum($rows, ['amount', 'tax', 'total']),
            ],
        ]);
    }

    private function tax(Carbon $from, Carbon $to): array
    {
        $range = [$from->toDateString(), $to->toDateString()];
        $invoiceRows = Invoice::counted()->whereDate('issue_date', '>=', $from)->whereDate('issue_date', '<=', $to)->orderBy('issue_date')->orderBy('number')->get()
            ->map(fn (Invoice $i) => [
                'date' => $i->issue_date->toDateString(), 'document' => $i->number, 'type' => 'Invoice',
                'customer' => $i->buyer['name'] ?? '', 'taxable' => $i->subtotal_sen - $i->discount_sen, 'tax' => $i->tax_sen,
            ]);
        $creditRows = CreditNote::whereDate('issue_date', '>=', $from)->whereDate('issue_date', '<=', $to)->orderBy('issue_date')->orderBy('number')->get()
            ->map(fn (CreditNote $c) => [
                'date' => $c->issue_date->toDateString(), 'document' => $c->number, 'type' => 'Credit note',
                'customer' => $c->buyer['name'] ?? '', 'taxable' => -$c->subtotal_sen, 'tax' => -$c->tax_sen,
            ]);
        $rows = $invoiceRows->concat($creditRows)->sortBy([['date', 'asc'], ['document', 'asc']])->values();
        $totals = $this->sum($rows, ['taxable', 'tax']);

        return $this->report('tax', $from, $to, [
            ['label' => 'Taxable sales', 'value' => $totals['taxable'], 'type' => 'money'],
            ['label' => 'Tax charged', 'value' => $totals['tax'], 'type' => 'money'],
        ], [[
            'title' => 'Invoices and credit notes',
            'columns' => [
                $this->col('date', 'Date', 'date'), $this->col('document', 'Document no.'), $this->col('type', 'Type'),
                $this->col('customer', 'Customer'), $this->col('taxable', 'Taxable amount', 'money'), $this->col('tax', 'Tax', 'money'),
            ],
            'rows' => $rows->all(),
            'totals' => $totals,
        ]], null, 'Credit notes are shown as negative amounts. Check figures with your accountant before filing a return.');
    }

    /**
     * A customer statement: opening balance, every invoice, payment, refund and credit note in date order with a running balance.
     */
    public function statement(Customer $customer, Carbon $from, Carbon $to): array
    {
        $events = collect();
        foreach ($customer->invoices()->counted()->get() as $i) {
            $events->push(['date' => $i->issue_date, 'sort' => 1, 'document' => $i->number, 'description' => 'Invoice'.($i->reference ? " · {$i->reference}" : ''), 'debit' => $i->total_sen, 'credit' => 0]);
        }
        foreach ($customer->payments()->where('status', Payment::CONFIRMED)->with('invoice')->get() as $p) {
            $events->push($p->isRefund()
                ? ['date' => $p->paid_on, 'sort' => 3, 'document' => $p->receipt_number, 'description' => "Refund for {$p->invoice->number}", 'debit' => $p->amount_sen, 'credit' => 0]
                : ['date' => $p->paid_on, 'sort' => 2, 'document' => $p->receipt_number, 'description' => "Payment for {$p->invoice->number} · {$p->methodLabel()}", 'debit' => 0, 'credit' => $p->amount_sen]);
        }
        foreach ($customer->creditNotes()->with('invoice')->get() as $c) {
            $events->push(['date' => $c->issue_date, 'sort' => 2, 'document' => $c->number, 'description' => "Credit note for {$c->invoice->number}", 'debit' => 0, 'credit' => $c->total_sen]);
        }
        $events = $events->sortBy([['date', 'asc'], ['sort', 'asc'], ['document', 'asc']])->values();

        $opening = $events->filter(fn ($e) => $e['date']->lt($from))->sum(fn ($e) => $e['debit'] - $e['credit']);
        $running = $opening;
        $rows = $events->filter(fn ($e) => $e['date']->betweenIncluded($from, $to))->map(function ($e) use (&$running) {
            $running += $e['debit'] - $e['credit'];

            return [
                'date' => $e['date']->toDateString(), 'document' => $e['document'], 'description' => $e['description'],
                'debit' => $e['debit'], 'credit' => $e['credit'], 'balance' => $running,
            ];
        })->values();

        $report = $this->report('statement', $from, $to, [
            ['label' => 'Opening balance', 'value' => $opening, 'type' => 'money'],
            ['label' => 'Invoiced', 'value' => $rows->sum('debit'), 'type' => 'money'],
            ['label' => 'Paid and credited', 'value' => $rows->sum('credit'), 'type' => 'money'],
            ['label' => 'Closing balance', 'value' => $running, 'type' => 'money'],
        ], [[
            'title' => 'Transactions',
            'columns' => [
                $this->col('date', 'Date', 'date'), $this->col('document', 'Document no.'), $this->col('description', 'Description'),
                $this->col('debit', 'Charges', 'money'), $this->col('credit', 'Payments & credits', 'money'), $this->col('balance', 'Balance', 'money'),
            ],
            'rows' => $rows->all(),
            'totals' => ['debit' => $rows->sum('debit'), 'credit' => $rows->sum('credit'), 'balance' => $running],
        ]], null, 'A positive balance is owed to us. A negative balance is owed to the customer.');
        $report['title'] = 'Statement of account';
        $report['customer'] = $customer->snapshot();

        return $report;
    }

    // ---------------------------------------------------------------- helpers

    private function report(string $key, Carbon $from, Carbon $to, array $summary, array $tables, ?string $period = null, ?string $note = null): array
    {
        return [
            'key' => $key,
            'title' => self::TYPES[$key] ?? ucfirst($key),
            'period' => $period ?? $from->format('j M Y').' to '.$to->format('j M Y'),
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'generated_at' => now()->toIso8601String(),
            'note' => $note,
            'summary' => $summary,
            'tables' => $tables,
        ];
    }

    private function col(string $key, string $label, string $type = 'text'): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type];
    }

    private function sum(Collection $rows, array $keys): array
    {
        return collect($keys)->mapWithKeys(fn ($k) => [$k => (int) $rows->sum($k)])->all();
    }

    public function statusLabel(string $status): string
    {
        return [
            Invoice::DRAFT => 'Draft', Invoice::ISSUED => 'Awaiting payment', Invoice::PARTIALLY_PAID => 'Partly paid',
            Invoice::PAID => 'Paid', Invoice::CREDITED => 'Credited', Invoice::VOID => 'Void',
        ][$status] ?? $status;
    }
}
