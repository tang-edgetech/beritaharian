<?php

namespace App\Http\Controllers\Api\Public;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Directory\Present;
use App\Models\Area;
use App\Models\Directory\Business;
use App\Models\Directory\BusinessLocation;
use App\Models\Directory\Review;
use App\Models\Directory\Sector;
use App\Services\Directory\DetailSchema;
use App\Services\Directory\OpeningHours;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Read-only places for Peta Melaka (public site and, later, the app). No sign-in needed. */
class PlaceController extends Controller
{
    /** GET /public/sectors — every active sector with its filters and how many places it has. */
    public function sectors(): JsonResponse
    {
        $sectors = Sector::ordered()->where('is_active', true)
            ->withCount(['businesses' => fn (Builder $b) => $b->active()])->get();

        return response()->json(['data' => $sectors->map(fn (Sector $s) => Present::sector($s))]);
    }

    /**
     * GET /public/places?sector=&area=&q=&open_now=1&lat=&lng=&radius_km=&sort=recommended|rating|distance|newest|name&details[halal]=1&per_page=
     * One row per branch, so a chain shows each of its shops on the map.
     */
    public function index(Request $request): JsonResponse
    {
        [$query, $lat, $lng] = $this->query($request);
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);
        $page = $query->with(['business.sector', 'business.logo', 'business.photos', 'area', 'hours'])
            ->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (BusinessLocation $l) => Present::card($l, $lat, $lng)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    /** GET /public/places/pins — same filters, every match as a small pin for the map (up to 2,000). */
    public function pins(Request $request): JsonResponse
    {
        [$query] = $this->query($request);
        $pins = $query->with(['business.sector'])->limit(2000)->get();

        return response()->json(['data' => $pins->map(fn (BusinessLocation $l) => Present::pin($l))]);
    }

    /** GET /public/places/{slug} */
    public function show(string $slug): JsonResponse
    {
        $business = $this->find($slug)->load(['sector', 'logo', 'photos', 'locations.area', 'locations.hours']);

        return response()->json(['data' => Present::detail($business)]);
    }

    /** GET /public/places/{slug}/reviews?sort=newest|helpful|highest|lowest&rating=&page= */
    public function reviews(Request $request, string $slug): JsonResponse
    {
        $business = $this->find($slug);
        $query = $business->reviews()->visible()->with(['user', 'photos', 'reply', 'location'])
            ->when((int) $request->query('rating'), fn (Builder $q, int $r) => $q->where('rating', $r));
        match ($request->query('sort')) {
            'helpful' => $query->orderByDesc('helpful_count')->latest('published_at'),
            'highest' => $query->orderByDesc('rating')->latest('published_at'),
            'lowest' => $query->orderBy('rating')->latest('published_at'),
            default => $query->latest('published_at'),
        };
        $page = $query->paginate(10)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Review $r) => Present::review($r)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    private function find(string $slug): Business
    {
        return Business::active()->where('slug', $slug)->first()
            ?? throw new FriendlyException('We couldn’t find that place.', 'NOT_FOUND', 404);
    }

    /** @return array{0: Builder, 1: ?float, 2: ?float} */
    private function query(Request $request): array
    {
        $lat = is_numeric($request->query('lat')) ? (float) $request->query('lat') : null;
        $lng = is_numeric($request->query('lng')) ? (float) $request->query('lng') : null;
        if ($lat !== null && (abs($lat) > 90 || $lng === null || abs($lng) > 180)) {
            $lat = $lng = null;
        }
        $sector = $request->query('sector') ? Sector::where('slug', $request->query('sector'))->first() : null;
        $q = trim((string) $request->query('q'));

        $query = BusinessLocation::query()
            ->whereHas('business', function (Builder $b) use ($request, $sector, $q) {
                $b->active();
                if ($request->query('sector')) {
                    $b->where('sector_id', $sector?->id ?? 0);
                }
                if ($sector && is_array($request->query('details'))) {
                    DetailSchema::filter($b, $sector, $request->query('details'));
                }
                if ($q !== '') {
                    $b->where(function (Builder $w) use ($q) {
                        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true) && mb_strlen($q) >= 3) {
                            $w->whereFullText('search_text', $q);
                        } else {
                            $w->where('search_text', 'like', '%'.$q.'%');
                        }
                    });
                }
            })
            ->when($request->query('area'), function (Builder $b, $slug) {
                $area = Area::where('slug', $slug)->first();
                $b->whereIn('area_id', $area ? $area->selfAndChildIds() : [0]);
            })
            ->when($request->boolean('open_now'), fn (Builder $b) => $b->whereHas('hours', fn (Builder $h) => OpeningHours::constrainOpenAt($h, now())));

        // a rough box first, so the distance sort only looks at nearby rows
        if ($lat !== null && ($radius = (float) $request->query('radius_km'))) {
            $dLat = min($radius, 100) / 111;
            $dLng = $dLat / max(cos(deg2rad($lat)), 0.01);
            $query->whereBetween('latitude', [$lat - $dLat, $lat + $dLat])->whereBetween('longitude', [$lng - $dLng, $lng + $dLng]);
        }

        $sort = $request->query('sort', $lat !== null ? 'distance' : 'recommended');
        $businessColumn = fn (string $expression) => Business::selectRaw($expression)->whereColumn('businesses.id', 'business_locations.business_id');
        match (true) {
            $sort === 'distance' && $lat !== null => $query->orderByRaw(
                '((latitude - ?) * (latitude - ?)) + ((longitude - ?) * ? * (longitude - ?) * ?)',
                [$lat, $lat, $lng, cos(deg2rad($lat)), $lng, cos(deg2rad($lat))]
            ),
            $sort === 'rating' => $query->orderByDesc($businessColumn('rating_avg'))->orderByDesc($businessColumn('rating_count')),
            $sort === 'newest' => $query->orderByDesc($businessColumn('approved_at')),
            $sort === 'name' => $query->orderBy($businessColumn('slug')),
            // recommended: stars, weighted so one 5-star review doesn't beat fifty 4.6s; claimed listings next
            default => $query->orderByDesc($businessColumn('rating_avg * rating_count / (rating_count + 3)'))->orderByDesc($businessColumn('is_claimed')),
        };
        $query->orderBy('business_locations.id');

        return [$query, $lat, $lng];
    }
}
