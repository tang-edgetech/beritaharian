@php use App\Support\Money; @endphp
@extends('billing.layout')

@section('content')
  <h2 style="font-size:13pt">{{ $report['title'] }}</h2>
  <div class="muted">{{ $report['period'] }}</div>

  @if(!empty($report['customer']))
    <div class="spacer"></div>
    @include('billing.partials.parties', ['seller' => $seller, 'buyer' => $report['customer'], 'buyerLabel' => 'Customer'])
  @endif

  <div class="spacer"></div>
  <table class="summary">
    <tr>
      @foreach($report['summary'] as $item)
        <td>
          <div class="summary-label">{{ $item['label'] }}</div>
          <div class="summary-value">{{ $item['type'] === 'money' ? Money::format($item['value']) : number_format($item['value']) }}</div>
        </td>
      @endforeach
    </tr>
  </table>

  @foreach($report['tables'] as $table)
    <div class="spacer"></div>
    <h2>{{ $table['title'] }}</h2>
    <table class="lines">
      <thead>
        <tr>
          @foreach($table['columns'] as $column)
            <th class="{{ in_array($column['type'], ['money', 'number']) ? 'num' : '' }}">{{ $column['label'] }}</th>
          @endforeach
        </tr>
      </thead>
      <tbody>
        @forelse($table['rows'] as $index => $row)
          <tr class="{{ $index % 2 ? 'zebra' : '' }}">
            @foreach($table['columns'] as $column)
              @php $value = $row[$column['key']] ?? null; @endphp
              <td class="{{ in_array($column['type'], ['money', 'number']) ? 'num' : '' }}">
                @if($column['type'] === 'money'){{ Money::format((int) $value, false) }}
                @elseif($column['type'] === 'date'){{ $value ? \Illuminate\Support\Carbon::parse($value)->format('j M Y') : '—' }}
                @elseif($column['type'] === 'number'){{ number_format((int) $value) }}
                @else{{ $value ?? '—' }}@endif
              </td>
            @endforeach
          </tr>
        @empty
          <tr><td colspan="{{ count($table['columns']) }}" class="muted">Nothing in this period.</td></tr>
        @endforelse
      </tbody>
      @if(!empty($table['totals']) && count($table['rows']))
        <tfoot>
          <tr>
            @foreach($table['columns'] as $index => $column)
              <td class="{{ in_array($column['type'], ['money', 'number']) ? 'num' : '' }}">
                @if(array_key_exists($column['key'], $table['totals']))
                  {{ $column['type'] === 'money' ? Money::format($table['totals'][$column['key']], false) : number_format($table['totals'][$column['key']]) }}
                @elseif($index === 0) Total @endif
              </td>
            @endforeach
          </tr>
        </tfoot>
      @endif
    </table>
  @endforeach

  <div class="small muted" style="margin-top:4mm">Amounts in Malaysian Ringgit (RM).@if($report['note']) {{ $report['note'] }}@endif</div>
@endsection
