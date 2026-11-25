{{-- "From" and "Bill to" boxes, using the details frozen on the document. --}}
<table class="parties">
  <tr>
    <td>
      <div class="party-box">
        <div class="party-label">From</div>
        <div class="party-name">{{ $seller['name'] ?? '' }}</div>
        @foreach(($seller['address'] ?? []) as $line)<div>{{ $line }}</div>@endforeach
        @if(!empty($seller['email']))<div class="muted">{{ $seller['email'] }}</div>@endif
        @if(!empty($seller['phone']))<div class="muted">{{ $seller['phone'] }}</div>@endif
      </div>
    </td>
    <td>
      <div class="party-box">
        <div class="party-label">{{ $buyerLabel ?? 'Bill to' }}</div>
        <div class="party-name">{{ $buyer['name'] ?? '' }}</div>
        @if(!empty($buyer['registration_no']))<div class="small muted">Reg. / IC no. {{ $buyer['registration_no'] }}</div>@endif
        @if(!empty($buyer['tax_id']))<div class="small muted">TIN {{ $buyer['tax_id'] }}</div>@endif
        @foreach(($buyer['address'] ?? []) as $line)<div>{{ $line }}</div>@endforeach
        @if(!empty($buyer['contact_person']))<div>Attn: {{ $buyer['contact_person'] }}</div>@endif
        @if(!empty($buyer['email']))<div class="muted">{{ $buyer['email'] }}</div>@endif
      </div>
    </td>
  </tr>
</table>
