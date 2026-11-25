<?php

namespace App\Http\Controllers\Api\Admin\Billing;

use App\Http\Controllers\Controller;
use App\Services\Billing\DocumentService;
use App\Services\Billing\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    /** GET /admin/billing/reports/{type}?from=2026-01-01&to=2026-12-31&format=json|pdf|csv */
    public function show(Request $request, string $type, ReportService $reports, DocumentService $documents): JsonResponse|Response
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'format' => ['nullable', 'in:json,pdf,csv'],
        ]);

        $from = isset($data['from']) ? Carbon::parse($data['from']) : today()->startOfMonth();
        $to = isset($data['to']) ? Carbon::parse($data['to']) : today();
        $report = $reports->build($type, $from, $to);
        $name = $type === 'outstanding' ? "{$report['title']} {$to->toDateString()}" : "{$report['title']} {$from->toDateString()} to {$to->toDateString()}";

        return match ($data['format'] ?? 'json') {
            'pdf' => $documents->report($report)->download($documents->filename($name, 'pdf')),
            'csv' => $documents->reportCsv($report, $documents->filename($name, 'csv')),
            default => response()->json(['data' => $report]),
        };
    }
}
