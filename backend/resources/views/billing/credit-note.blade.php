@php use App\Support\Money; @endphp
@extends('billing.layout')

@section('content')
  @include('billing.partials.parties', ['seller' => $seller, 'buyer' => $buyer, 'buyerLabel' => 'Credit to'])

  <div class="spacer"></div>

  <table class="parties">
    <tr>
      <td class="col-left">
        <table class="facts">
          <tr><td class="fact-label">Credit note no.</td><td class="fact-value">{{ $note->number }}</td></tr>
          <tr><td class="fact-label">Date</td><td class="fact-value">{{ $note->issue_date->format('j M Y') }}</td></tr>
        </table>
      </td>
      <td>
        <table class="facts">
          <tr><td class="fact-label">Original invoice</td><td class="fact-value">{{ $invoice->number }}</td></tr>
          <tr><td class="fact-label">Invoice date</td><td class="fact-value">{{ $invoice->issue_date->format('j M Y') }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <div class="spacer"></div>

  <table class="lines">
    <thead><tr><th>Description</th><th class="num" style="width:22%">Amount</th></tr></thead>
    <tbody>
      <tr><td>{{ $note->description }}<br><span class="small muted">Reason: {{ $note->reason }}</span></td><td class="num">{{ Money::format($note->subtotal_sen) }}</td></tr>
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Before tax</td><td class="num">{{ Money::format($note->subtotal_sen) }}</td></tr>
    @if($note->tax_sen)<tr><td>{{ $taxLabel }} ({{ rtrim(rtrim($note->tax_rate, '0'), '.') }}%)</td><td class="num">{{ Money::format($note->tax_sen) }}</td></tr>@endif
    <tr class="grand"><td>Total credit</td><td class="num">{{ Money::format($note->total_sen) }}</td></tr>
  </table>

  <div class="small muted" style="margin-top:2mm">Amount in words: {{ $amountInWords }}</div>

  <div class="note-box">This credit note reduces the amount of invoice {{ $invoice->number }}. Invoice balance after this credit: {{ Money::format($invoice->balanceSen()) }}.</div>
@endsection
