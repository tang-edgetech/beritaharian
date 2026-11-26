<?php

namespace App\Http\Controllers\Api\Public;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Civic\IncidentPresent;
use App\Models\Area;
use App\Models\Civic\Incident;
use App\Models\Civic\IncidentType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Verified civic alerts for the public site and the app. Only staff-written text and blurred photos. */
class AlertController extends Controller
{
    private const WITH = ['type', 'area', 'publicPhotos'];

    /** GET /public/alert-types: what readers can report. */
    public function types(): JsonResponse
    {
        return response()->json(['data' => IncidentType::where('is_active', true)->ordered()->get()->map(fn ($t) => IncidentPresent::type($t))]);
    }

    /** GET /public/alerts?state=active|resolved|all&type=&area=&severity=&q=&lat=&lng=&page= */
    public function index(Request $request): JsonResponse
    {
        [$query, $lat, $lng] = $this->query($request);
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);
        $page = $query->with(self::WITH)->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Incident $i) => IncidentPresent::alert($i, $lat, $lng)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    /** GET /public/alerts/pins: every matching alert as a light map pin. */
    public function pins(Request $request): JsonResponse
    {
        [$query] = $this->query($request);

        return response()->json(['data' => $query->with('type')->limit(1000)->get()->map(fn (Incident $i) => IncidentPresent::alertPin($i))]);
    }

    /** GET /public/alerts/{ref} */
    public function show(string $ref): JsonResponse
    {
        $incident = Incident::alerts()->with([...self::WITH, 'reporter'])->where('reference_no', $ref)->first();
        if (! $incident) {
            throw new FriendlyException('We couldn’t find that alert. It may have been taken down.', 'NOT_FOUND', 404);
        }

        return response()->json(['data' => IncidentPresent::alertDetail($incident)]);
    }

    /** @return array{0: Builder, 1: ?float, 2: ?float} */
    private function query(Request $request): array
    {
        $lat = is_numeric($request->query('lat')) ? (float) $request->query('lat') : null;
        $lng = is_numeric($request->query('lng')) ? (float) $request->query('lng') : null;
        if ($lat === null || $lng === null) {
            $lat = $lng = null;
        }

        $query = Incident::alerts()
            ->when($request->query('state', 'active'), fn (Builder $q, $state) => match ($state) {
                'resolved' => $q->where('status', Incident::CLOSED),
                'all' => $q,
                default => $q->where('status', Incident::VERIFIED),
            })
            ->when($request->query('type'), fn (Builder $q, $slug) => $q->whereHas('type', fn (Builder $t) => $t->whereIn('slug', (array) $slug)))
            ->when($request->query('severity'), fn (Builder $q, $s) => $q->whereIn('severity', (array) $s))
            ->when($request->query('area'), function (Builder $q, $slug) {
                $area = Area::where('slug', $slug)->first();
                $q->whereIn('area_id', $area ? $area->selfAndChildIds() : [0]);
            })
            ->when(trim((string) $request->query('q')), fn (Builder $q, $term) => $q->where(fn (Builder $w) => $w
                ->where('public_title', 'like', "%{$term}%")->orWhere('public_summary', 'like', "%{$term}%")->orWhere('public_address', 'like', "%{$term}%")));

        if ($lat !== null && $request->query('sort') === 'distance') {
            $cos = cos(deg2rad($lat));
            $query->orderByRaw('((latitude - ?) * (latitude - ?)) + ((longitude - ?) * ? * (longitude - ?) * ?)', [$lat, $lat, $lng, $cos, $lng, $cos]);
        } else {
            $query->orderByDesc('alert_published_at');
        }
        $query->orderByDesc('id');

        return [$query, $lat, $lng];
    }
}
