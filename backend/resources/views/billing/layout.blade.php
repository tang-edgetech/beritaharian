{{-- Shared frame for every printed finance document. dompdf understands CSS 2.1 and tables, so the layout is built from tables. --}}
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $documentTitle }}</title>
<style>
  @page { margin: 26mm 16mm 22mm 16mm; }
  * { font-family: "DejaVu Sans", sans-serif; }
  body { font-size: 8.8pt; color: #26211d; line-height: 1.32; margin: 0; }
  .doc-header { position: fixed; top: -18mm; left: 0; right: 0; height: 14mm; border-bottom: 2px solid #1f6b4a; }
  .doc-header table { width: 100%; border-collapse: collapse; }
  .doc-header-logo { width: 12mm; }
  .doc-header-logo img { width: 11mm; height: 11mm; }
  .doc-header-name { font-size: 12pt; font-weight: bold; color: #1f6b4a; }
  .doc-header-meta { font-size: 7.5pt; color: #685c50; }
  .doc-header-title { text-align: right; font-size: 13pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: #33190b; }
  .doc-footer { position: fixed; bottom: -15mm; left: 0; right: 0; height: 10mm; border-top: 1px solid #e4ddd5; font-size: 7pt; color: #847768; padding-top: 2mm; }

  h2 { font-size: 10pt; margin: 0 0 2mm; color: #33190b; }
  .muted { color: #685c50; }
  .small { font-size: 7.5pt; }
  .strong { font-weight: bold; }
  .right { text-align: right; }
  .nowrap { white-space: nowrap; }
  .spacer { height: 4.5mm; }
  .col-left { padding-right: 7mm !important; }

  .parties { width: 100%; border-collapse: collapse; }
  .parties td { vertical-align: top; width: 50%; padding: 0; }
  .party-box { border: 1px solid #e4ddd5; padding: 2.5mm 3.5mm; margin-right: 3mm; min-height: 27mm; }
  .party-label { font-size: 7pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: #847768; margin-bottom: 1mm; }
  .party-name { font-size: 10pt; font-weight: bold; }

  .facts { width: 100%; border-collapse: collapse; }
  .facts td { padding: 1mm 0; border-bottom: 1px solid #f2eee9; vertical-align: top; }
  .facts td.fact-label { color: #685c50; width: 40%; }
  .facts td.fact-value { text-align: right; font-weight: bold; }

  table.lines { width: 100%; border-collapse: collapse; }
  table.lines th { background: #1f6b4a; color: #fffaf0; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; padding: 2mm; text-align: left; }
  table.lines td { padding: 1.6mm 2mm; border-bottom: 1px solid #e4ddd5; vertical-align: top; }
  table.lines tr.zebra td { background: #faf8f5; }
  table.lines th.num, table.lines td.num { text-align: right; white-space: nowrap; }
  table.lines tfoot td { font-weight: bold; border-top: 1.5px solid #26211d; border-bottom: none; background: #f2eee9; }

  .totals { width: 46%; margin-left: 54%; border-collapse: collapse; margin-top: 3mm; }
  .totals td { padding: 1.1mm 2mm; }
  .totals td.num { text-align: right; white-space: nowrap; }
  .totals tr.grand td { font-size: 11pt; font-weight: bold; border-top: 1.5px solid #26211d; border-bottom: 1.5px solid #26211d; background: #fcecc9; }
  .totals tr.balance td { font-weight: bold; color: #33190b; }

  .note-box { border-left: 3px solid #f0b443; background: #fef8ec; padding: 2mm 4mm; margin-top: 3mm; }
  .pay-box { border: 1px solid #a9d6bd; background: #eef7f2; padding: 2.5mm 4mm; margin-top: 4mm; }
  .stamp { position: fixed; top: 70mm; left: 30mm; width: 120mm; text-align: center; font-size: 60pt; font-weight: bold; letter-spacing: 8px;
           color: #c23b2e; opacity: .14; transform: rotate(-24deg); }
  .stamp.is-paid { color: #1f6b4a; }
  .summary { width: 100%; border-collapse: separate; border-spacing: 2mm 0; margin: 0 -2mm; }
  .summary td { border: 1px solid #e4ddd5; padding: 2.5mm 3mm; width: 25%; vertical-align: top; }
  .summary-label { font-size: 7pt; text-transform: uppercase; letter-spacing: .5px; color: #847768; }
  .summary-value { font-size: 11pt; font-weight: bold; margin-top: 1mm; }
</style>
</head>
<body>
  <div class="doc-header">
    <table>
      <tr>
        <td class="doc-header-logo"><img src="{{ $logo }}" alt=""></td>
        <td>
          <div class="doc-header-name">{{ $seller['name'] ?? 'Cendol Satay' }}</div>
          <div class="doc-header-meta">
            @if(!empty($seller['registration_no']))Reg. no. {{ $seller['registration_no'] }}@endif
            @if(!empty($seller['tax_id'])) · TIN {{ $seller['tax_id'] }}@endif
            @if(!empty($seller['sst_no'])) · SST {{ $seller['sst_no'] }}@endif
          </div>
        </td>
        <td class="doc-header-title">{{ $documentTitle }}</td>
      </tr>
    </table>
  </div>

  <div class="doc-footer">
    {{ $seller['name'] ?? 'Cendol Satay' }}@if(!empty($seller['email'])) · {{ $seller['email'] }}@endif @if(!empty($seller['phone'])) · {{ $seller['phone'] }}@endif @if(!empty($seller['website'])) · {{ $seller['website'] }}@endif
    <br>Generated {{ now()->timezone(config('app.timezone'))->format('j M Y, g:i a') }}. This is a computer-generated document.
  </div>

  @yield('content')

  <script type="text/php">
    if (isset($pdf)) {
      $font = $fontMetrics->getFont("DejaVu Sans", "normal");
      $pdf->page_text($pdf->get_width() - 110, $pdf->get_height() - 34, "Page {PAGE_NUM} of {PAGE_COUNT}", $font, 7, [0.52, 0.47, 0.41]);
    }
  </script>
</body>
</html>
