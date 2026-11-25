<?php

namespace App\Services\Billing;

use App\Models\Billing\CreditNote;
use App\Models\Billing\Invoice;
use App\Models\Billing\Payment;
use App\Services\SettingService;
use App\Support\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as PdfDocument;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Prints finance documents and reports as A4 PDFs, and reports as CSV for spreadsheets and accountants. */
class DocumentService
{
    public function __construct(private SettingService $settings, private BillingService $billing) {}

    public function invoice(Invoice $invoice): PdfDocument
    {
        $invoice->loadMissing(['lines', 'customer']);
        $hasTax = $invoice->tax_sen > 0;

        return $this->render('billing.invoice', [
            'documentTitle' => $invoice->status === Invoice::DRAFT ? 'Draft invoice' : ($hasTax ? 'Tax invoice' : 'Invoice'),
            'invoice' => $invoice,
            'seller' => $invoice->seller ?? $this->billing->sellerSnapshot(),
            'buyer' => $invoice->buyer ?? $invoice->customer->snapshot(),
            'hasTax' => $hasTax,
            'hasDiscount' => $invoice->discount_sen > 0,
            'taxLabel' => $invoice->seller['tax_label'] ?? $this->settings->get('billing', 'tax_label', 'SST'),
            'amountInWords' => Money::words($invoice->total_sen),
        ]);
    }

    public function receipt(Payment $payment): PdfDocument
    {
        $payment->loadMissing(['invoice', 'customer']);

        return $this->render('billing.receipt', [
            'documentTitle' => $payment->isRefund() ? 'Refund voucher' : 'Official receipt',
            'payment' => $payment,
            'invoice' => $payment->invoice,
            'seller' => $this->billing->sellerSnapshot(),
            'buyer' => $payment->invoice->buyer ?? $payment->customer->snapshot(),
            'amountInWords' => Money::words($payment->amount_sen),
        ]);
    }

    public function creditNote(CreditNote $note): PdfDocument
    {
        $note->loadMissing(['invoice', 'customer']);

        return $this->render('billing.credit-note', [
            'documentTitle' => 'Credit note',
            'note' => $note,
            'invoice' => $note->invoice,
            'seller' => $note->seller ?? $this->billing->sellerSnapshot(),
            'buyer' => $note->buyer ?? $note->customer->snapshot(),
            'taxLabel' => $note->seller['tax_label'] ?? 'SST',
            'amountInWords' => Money::words($note->total_sen),
        ]);
    }

    public function report(array $report): PdfDocument
    {
        $wide = collect($report['tables'])->max(fn ($t) => count($t['columns'])) > 7;

        return $this->render('billing.report', [
            'documentTitle' => $report['key'] === 'statement' ? 'Statement' : 'Report',
            'report' => $report,
            'seller' => $this->billing->sellerSnapshot(),
        ], $wide ? 'landscape' : 'portrait');
    }

    /** Every table of the report one after another, with a title row above each and money in ringgit. */
    public function reportCsv(array $report, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($report) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // so Excel reads RM and names correctly
            fputcsv($out, [$report['title']]);
            fputcsv($out, [$report['period']]);
            fputcsv($out, []);
            foreach ($report['summary'] as $item) {
                fputcsv($out, [$item['label'], $item['type'] === 'money' ? number_format($item['value'] / 100, 2, '.', '') : $item['value']]);
            }
            foreach ($report['tables'] as $table) {
                fputcsv($out, []);
                fputcsv($out, [$table['title']]);
                fputcsv($out, array_map(fn ($c) => $c['label'].($c['type'] === 'money' ? ' (RM)' : ''), $table['columns']));
                foreach ($table['rows'] as $row) {
                    fputcsv($out, array_map(fn ($c) => $this->csvValue($row[$c['key']] ?? null, $c['type']), $table['columns']));
                }
                if (! empty($table['totals']) && $table['rows']) {
                    fputcsv($out, array_map(fn ($c, $i) => array_key_exists($c['key'], $table['totals'])
                        ? $this->csvValue($table['totals'][$c['key']], $c['type'])
                        : ($i === 0 ? 'Total' : ''), $table['columns'], array_keys($table['columns'])));
                }
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function filename(string $name, string $extension): string
    {
        return Str::slug($name).'.'.$extension;
    }

    private function csvValue(mixed $value, string $type): string|int
    {
        return match ($type) {
            'money' => number_format(((int) $value) / 100, 2, '.', ''),
            'number' => (int) $value,
            default => (string) ($value ?? ''),
        };
    }

    private function render(string $view, array $data, string $orientation = 'portrait'): PdfDocument
    {
        $data['logo'] = 'data:image/png;base64,'.base64_encode(file_get_contents(resource_path('brand/logo.png')));

        return Pdf::loadView($view, $data)
            ->setPaper('a4', $orientation)
            ->setOption(['isPhpEnabled' => true, 'isRemoteEnabled' => false, 'defaultFont' => 'DejaVu Sans']);
    }
}
