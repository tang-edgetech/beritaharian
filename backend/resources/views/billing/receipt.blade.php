@php use App\Support\Money; @endphp
@extends('billing.layout')

@section('content')
  @include('billing.partials.parties', ['seller' => $seller, 'buyer' => $buyer, 'buyerLabel' => $payment->isRefund() ? 'Paid to' : 'Received from'])

  <div class="spacer"></div>

  <table class="parties">
    <tr>
      <td class="col-left">
        <table class="facts">
          <tr><td class="fact-label">{{ $payment->isRefund() ? 'Voucher no.' : 'Receipt no.' }}</td><td class="fact-value">{{ $payment->receipt_number }}</td></tr>
          <tr><td class="fact-label">Date {{ $payment->isRefund() ? 'paid' : 'received' }}</td><td class="fact-value">{{ $payment->paid_on->format('j M Y') }}</td></tr>
          <tr><td class="fact-label">Method</td><td class="fact-value">{{ $payment->methodLabel() }}</td></tr>
        </table>
      </td>
      <td>
        <table class="facts">
          <tr><td class="fact-label">For invoice</td><td class="fact-value">{{ $invoice->number }}</td></tr>
          <tr><td class="fact-label">Reference</td><td class="fact-value">{{ $payment->reference ?: '—' }}</td></tr>
          <tr><td class="fact-label">Invoice balance now</td><td class="fact-value">{{ Money::format($invoice->balanceSen()) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <div class="spacer"></div>

  <table class="lines">
    <thead><tr><th>Description</th><th class="num" style="width:22%">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>{{ $payment->isRefund() ? 'Refund' : 'Payment' }} for invoice {{ $invoice->number }} dated {{ $invoice->issue_date->format('j M Y') }}@if($payment->notes)<br><span class="small muted">{{ $payment->notes }}</span>@endif</td>
        <td class="num">{{ Money::format($payment->amount_sen) }}</td>
      </tr>
    </tbody>
    <tfoot><tr><td>Total {{ $payment->isRefund() ? 'refunded' : 'received' }}</td><td class="num">{{ Money::format($payment->amount_sen) }}</td></tr></tfoot>
  </table>

  <div class="small muted" style="margin-top:2mm">Amount in words: {{ $amountInWords }}</div>

  <div class="note-box">
    @if($payment->isRefund())
      We have paid this refund to you. Please keep this voucher for your records.
    @else
      Thank you. We have received your payment. Please keep this receipt for your records.
    @endif
  </div>
@endsection
