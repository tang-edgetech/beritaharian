{{-- Printed summary inside a police evidence pack. Uses the finance documents' frame (dompdf: CSS 2.1 and tables). --}}
@extends('billing.layout', ['documentTitle' => 'Evidence pack'])

@php
  $tz = config('app.timezone');
  $fmt = fn ($d) => $d ? $d->copy()->timezone($tz)->format('j M Y, g:i a') : '—';
  $size = function (int $bytes) {
      return $bytes >= 1048576 ? number_format($bytes / 1048576, 1).' MB' : number_format(max($bytes, 1) / 1024, 0).' KB';
  };
  $statusLabels = \App\Http\Resources\Civic\IncidentPresent::STAFF_STATUS;
@endphp

@section('content')
  <table class="parties">
    <tr>
      <td>
        <div class="party-box">
          <div class="party-label">Incident</div>
          <div class="party-name">{{ $incident->reference_no }}</div>
          <div>{{ $incident->type?->getTranslation('name', 'en') }} · {{ ucfirst($incident->severity) }} severity</div>
          <div class="muted">Status: {{ $statusLabels[$incident->status] ?? $incident->status }}</div>
          <div class="muted">Happened: {{ $fmt($incident->occurred_at) }}</div>
          <div class="muted">Reported: {{ $fmt($incident->created_at) }}</div>
        </div>
      </td>
      <td>
        <div class="party-box">
          <div class="party-label">Handed to</div>
          <div class="party-name">{{ $handover->agency }}</div>
          <div>{{ $handover->officer_name }}@if($handover->officer_id) ({{ $handover->officer_id }})@endif</div>
          <div class="muted">Police report no. {{ $handover->police_report_no }}</div>
          <div class="muted">Prepared by {{ $handover->exporter?->name }} on {{ $fmt(now()) }}</div>
          <div class="muted small">Handover ID {{ $handover->ulid }}</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="spacer"></div>
  <h2>Location</h2>
  <table class="facts">
    <tr><td class="fact-label">Coordinates</td><td class="fact-value">{{ number_format($incident->latitude, 6) }}, {{ number_format($incident->longitude, 6) }}</td></tr>
    <tr><td class="fact-label">Area</td><td class="fact-value">{{ $incident->area?->getTranslation('name', 'en') ?? '—' }}</td></tr>
    <tr><td class="fact-label">Reporter's description of the place</td><td class="fact-value">{{ $incident->address ?: '—' }}</td></tr>
  </table>

  <div class="spacer"></div>
  <h2>Reporter</h2>
  <table class="facts">
    <tr><td class="fact-label">Name</td><td class="fact-value">{{ $incident->reporter?->name }}</td></tr>
    <tr><td class="fact-label">Email</td><td class="fact-value">{{ $incident->reporter?->email }}</td></tr>
    <tr><td class="fact-label">Phone</td><td class="fact-value">{{ $incident->reporter?->phone ?: '—' }}</td></tr>
    <tr><td class="fact-label">Sent from IP address</td><td class="fact-value">{{ $incident->submitted_ip ?: '—' }}</td></tr>
    <tr><td class="fact-label">Privacy notice accepted</td><td class="fact-value">{{ $fmt($incident->consented_at) }}</td></tr>
  </table>

  <div class="spacer"></div>
  <h2>What the reporter wrote</h2>
  <div class="note-box">
    <div class="strong">{{ $incident->title }}</div>
    <div>{!! nl2br(e($incident->description)) !!}</div>
  </div>

  @if($incident->checklist)
    <div class="spacer"></div>
    <h2>Verifier's checks</h2>
    <table class="facts">
      @foreach($checklist as $key => $label)
        <tr><td class="fact-label">{{ $label }}</td><td class="fact-value">{{ !empty($incident->checklist[$key]) ? 'Yes' : 'No' }}</td></tr>
      @endforeach
      <tr><td class="fact-label">Decided by</td><td class="fact-value">{{ $incident->decider?->name ?? '—' }}, {{ $fmt($incident->decided_at) }}</td></tr>
    </table>
  @endif

  <div class="spacer"></div>
  <h2>Files in this pack</h2>
  <p class="muted small">Original files exactly as received. The SHA-256 was taken when each file arrived; manifest.txt in the pack lists the same values so they can be checked.</p>
  <table class="lines">
    <thead><tr><th>File</th><th>Received</th><th>Details</th></tr></thead>
    <tbody>
      @foreach($entries as $i => $entry)
        @php($e = $entry['item'])
        <tr class="{{ $i % 2 ? 'zebra' : '' }}">
          <td>
            <div class="strong">{{ $entry['name'] }}</div>
            <div class="small muted">Original name: {{ $e->original_name }}</div>
            <div class="small">SHA-256: {{ $e->sha256 }}</div>
          </td>
          <td class="nowrap">
            {{ $fmt($e->created_at) }}
            <div class="small muted">from {{ $e->source === 'staff' ? 'staff' : 'reporter' }}@if($e->uploader_ip), IP {{ $e->uploader_ip }}@endif</div>
          </td>
          <td class="small">
            {{ $e->mime }}, {{ $size($e->size) }}
            @if($e->captured_at)<div>Taken {{ $fmt($e->captured_at) }}</div>@endif
            @if(!empty($e->exif['make']) || !empty($e->exif['model']))<div>{{ trim(($e->exif['make'] ?? '').' '.($e->exif['model'] ?? '')) }}</div>@endif
            @if(isset($e->exif['latitude'], $e->exif['longitude']))<div>Photo GPS {{ $e->exif['latitude'] }}, {{ $e->exif['longitude'] }}</div>@endif
          </td>
        </tr>
      @endforeach
    </tbody>
  </table>

  <div class="spacer"></div>
  <h2>Timeline</h2>
  <table class="lines">
    <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
    <tbody>
      @foreach($incident->updates as $i => $u)
        <tr class="{{ $i % 2 ? 'zebra' : '' }}">
          <td class="nowrap">{{ $fmt($u->created_at) }}</td>
          <td>{{ $u->user?->name ?? 'System' }}</td>
          <td>
            @if($u->kind === 'status')Status: {{ $statusLabels[$u->from_status] ?? '—' }} → {{ $statusLabels[$u->to_status] ?? $u->to_status }}.@endif
            {{ $u->body }}
          </td>
        </tr>
      @endforeach
    </tbody>
  </table>

  @if($handover->notes)
    <div class="note-box">{{ $handover->notes }}</div>
  @endif
@endsection
