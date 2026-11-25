@php use App\Support\Money; @endphp
@extends('billing.layout')

@section('content')
  @if($invoice->status === 'void')
    <div class="stamp">VOID</div>
  @elseif($invoice->status === 'paid')
    <div class="stamp is-paid">PAID</div>
  @elseif($invoice->status === 'draft')
    <div class="stamp">DRAFT</div>
  @endif

  @include('billing.partials.parties', ['seller' => $seller, 'buyer' => $buyer])

  <div class="spacer"></div>

  <table class="parties">
    <tr>
      <td class="col-left">
        <table class="facts">
          <tr><td class="fact-label">Invoice no.</td><td class="fact-value">{{ $invoice->displayNumber() }}</td></tr>
          <tr><td class="fact-label">Invoice date</td><td class="fact-value">{{ $invoice->issue_date?->format('j M Y') ?? '—' }}</td></tr>
          <tr><td class="fact-label">Due date</td><td class="fact-value">{{ $invoice->due_date?->format('j M Y') ?? '—' }}</td></tr>
        </table>
      </td>
      <td>
        <table class="facts">
          <tr><td class="fact-label">Your reference</td><td class="fact-value">{{ $invoice->reference ?: '—' }}</td></tr>
          <tr><td class="fact-label">Currency</td><td class="fact-value">Malaysian Ringgit (MYR)</td></tr>
          <tr><td class="fact-label">Amount due</td><td class="fact-value">{{ Money::format(max(0, $invoice->status === 'draft' ? $invoice->total_sen : $invoice->balanceSen())) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <div class="spacer"></div>

  <table class="lines">
    <thead>
      <tr>
        <th style="width:6%">No.</th>
        <th>Description</th>
        <th class="num" style="width:10%">Qty</th>
        <th class="num" style="width:14%">Unit price</th>
        @if($hasDiscount)<th class="num" style="width:11%">Discount</th>@endif
        @if($hasTax)<th class="num" style="width:11%">{{ $taxLabel }}</th>@endif
        <th class="num" style="width:15%">Amount</th>
      </tr>
    </thead>
    <tbody>
      @foreach($invoice->lines as $index => $line)
        <tr class="{{ $index % 2 ? 'zebra' : '' }}">
          <td>{{ $index + 1 }}</td>
          <td>{{ $line->description }}</td>
          <td class="num">{{ rtrim(rtrim(number_format((float) $line->quantity, 2), '0'), '.') }}{{ $line->unit ? ' '.$line->unit : '' }}</td>
          <td class="num">{{ Money::format($line->unit_price_sen, false) }}</td>
          @if($hasDiscount)<td class="num">{{ $line->discount_sen ? Money::format($line->discount_sen, false) : '—' }}</td>@endif
          @if($hasTax)<td class="num">{{ $line->tax_sen ? Money::format($line->tax_sen, false).' ('.rtrim(rtrim($line->tax_rate, '0'), '.').'%)' : '—' }}</td>@endif
          <td class="num">{{ Money::format($line->amount_sen + $line->tax_sen, false) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="num">{{ Money::format($invoice->subtotal_sen) }}</td></tr>
    @if($invoice->discount_sen)<tr><td>Discount</td><td class="num">-{{ Money::format($invoice->discount_sen) }}</td></tr>@endif
    @if($hasTax)<tr><td>{{ $taxLabel }}</td><td class="num">{{ Money::format($invoice->tax_sen) }}</td></tr>@endif
    <tr class="grand"><td>Total</td><td class="num">{{ Money::format($invoice->total_sen) }}</td></tr>
    @if($invoice->credited_sen)<tr><td>Less credit notes</td><td class="num">-{{ Money::format($invoice->credited_sen) }}</td></tr>@endif
    @if($invoice->paid_sen)<tr><td>Less payments received</td><td class="num">-{{ Money::format($invoice->paid_sen) }}</td></tr>@endif
    @if($invoice->refunded_sen)<tr><td>Add refunds paid</td><td class="num">{{ Money::format($invoice->refunded_sen) }}</td></tr>@endif
    @if($invoice->status !== 'draft')
      <tr class="balance"><td>Balance due</td><td class="num">{{ Money::format($invoice->balanceSen()) }}</td></tr>
    @endif
  </table>

  <div class="small muted" style="margin-top:2mm">Amount in words: {{ $amountInWords }}</div>

  @if($invoice->status === 'void')
    <div class="note-box"><span class="strong">This invoice was voided</span> on {{ $invoice->voided_at?->timezone(config('app.timezone'))->format('j M Y') }}. Reason: {{ $invoice->void_reason }}. No payment is due.</div>
  @elseif(!empty($seller['bank']['account_no']) && $invoice->balanceSen() > 0)
    <div class="pay-box">
      <div class="strong">How to pay</div>
      <div>Bank transfer or DuitNow to <span class="strong">{{ $seller['bank']['account_name'] ?: $seller['name'] }}</span>,
        {{ $seller['bank']['name'] }} account <span class="strong">{{ $seller['bank']['account_no'] }}</span>.</div>
      <div>Please use <span class="strong">{{ $invoice->displayNumber() }}</span> as the payment reference.</div>
    </div>
  @endif

  @if($invoice->notes)
    <div class="note-box">{!! nl2br(e($invoice->notes)) !!}</div>
  @endif
  @if($invoice->terms)
    <div style="margin-top:4mm"><div class="party-label">Terms</div><div class="small muted">{!! nl2br(e($invoice->terms)) !!}</div></div>
  @endif
@endsection
