<?php

namespace App\Http\Controllers\Api\Admin\Directory;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Directory\Present;
use App\Models\Area;
use App\Models\Directory\Business;
use App\Models\Directory\BusinessClaim;
use App\Models\Directory\Review;
use App\Models\User;
use App\Services\Directory\BusinessService;
use App\Services\Directory\Geocoder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

class BusinessController extends Controller
{
    private const WITH = ['sector', 'logo', 'locations.area', 'creator'];

    private const WITH_FULL = ['sector', 'logo', 'photos', 'locations.area', 'locations.hours', 'members', 'creator'];

    public function __construct(private BusinessService $businesses) {}

    /** GET /admin/directory/businesses?filter[q]=&filter[status]=&filter[sector]=&filter[area]=&filter[claimed]=yes&filter[trashed]=only&sort=-updated_at */
    public function index(Request $request): JsonResponse
    {
        $page = QueryBuilder::for(Business::query()->with(self::WITH))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('search_text', 'like', "%{$value}%")->orWhere('slug', 'like', '%'.str($value)->slug().'%')->orWhere('ssm_number', 'like', "%{$value}%"))),
                AllowedFilter::callback('status', fn (Builder $q, $value) => $q->whereIn('status', (array) $value)),
                AllowedFilter::callback('sector', fn (Builder $q, $value) => $q->whereHas('sector', fn (Builder $s) => $s->where('slug', $value))),
                AllowedFilter::callback('area', function (Builder $q, $value) {
                    $area = Area::where('slug', $value)->first();
                    $q->whereHas('locations', fn (Builder $l) => $l->whereIn('area_id', $area ? $area->selfAndChildIds() : [0]));
                }),
                AllowedFilter::callback('claimed', fn (Builder $q, $value) => $q->where('is_claimed', $value === 'yes')),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('created_at', 'updated_at', AllowedSort::field('name', 'slug'), AllowedSort::field('rating', 'rating_avg'), AllowedSort::field('reviews', 'rating_count'))
            ->defaultSort('-updated_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Business $b) => Present::business($b)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    /** Counts for menu badges and the directory home. */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['data' => [
            'places' => Business::active()->count(),
            'new_places' => $user->can('directory.claims') ? Business::where('status', Business::PENDING)->count() : 0,
            'claims' => $user->can('directory.claims') ? BusinessClaim::where('status', BusinessClaim::PENDING)->count() : 0,
            'reviews_to_check' => $user->can('reviews.moderate') ? Review::whereIn('status', [Review::PENDING, Review::HELD])->count() : 0,
            'reported_reviews' => $user->can('reviews.moderate') ? Review::where('status', Review::VISIBLE)->where('open_reports', '>', 0)->count() : 0,
        ]]);
    }

    public function show(Business $business): JsonResponse
    {
        return response()->json(['data' => Present::business($business->load(self::WITH_FULL), true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $business = $this->businesses->save(null, $this->validated($request), $request->user());

        return response()->json(['message' => 'Place added.', 'data' => Present::business($business->fresh()->load(self::WITH_FULL), true)], 201);
    }

    public function update(Request $request, Business $business): JsonResponse
    {
        $business = $this->businesses->save($business, $this->validated($request, $business), $request->user());

        return response()->json(['message' => 'Place saved.', 'data' => Present::business($business->fresh()->load(self::WITH_FULL), true)]);
    }

    public function destroy(Business $business): JsonResponse
    {
        $business->delete();

        return response()->json(['message' => 'Place deleted. You can restore it from the deleted list.']);
    }

    public function restore(Business $business): JsonResponse
    {
        $business->restore();

        return response()->json(['message' => 'Place restored.']);
    }

    /** POST /admin/directory/businesses/{id}/status { action: approve|suspend|reinstate, note? } */
    public function status(Request $request, Business $business): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'suspend', 'reinstate'])],
            'note' => [Rule::requiredIf($request->input('action') === 'suspend'), 'nullable', 'string', 'max:1000'],
        ], ['note.required' => 'Please write why, so the owner can be told.']);

        $message = match ($data['action']) {
            'approve' => $this->authorizeClaims($request) ?? tap('Approved. The place is on the map.', fn () => $this->businesses->approve($business, $request->user())),
            'suspend' => tap('Taken off the map.', fn () => $this->businesses->suspend($business, $data['note'])),
            'reinstate' => tap('Back on the map.', fn () => $this->businesses->reinstate($business)),
        };

        return response()->json(['message' => $message, 'data' => Present::business($business->fresh()->load(self::WITH_FULL), true)]);
    }

    /** POST /admin/directory/businesses/bulk { action: approve|suspend|delete, ids[], note? } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'suspend', 'delete'])],
            'ids' => ['required', 'array', 'max:100'],
            'ids.*' => ['string'],
            'note' => [Rule::requiredIf($request->input('action') === 'suspend'), 'nullable', 'string', 'max:1000'],
        ]);
        if ($data['action'] === 'approve') {
            $this->authorizeClaims($request);
        }
        $count = 0;
        DB::transaction(function () use ($data, $request, &$count) {
            foreach (Business::whereIn('ulid', $data['ids'])->get() as $business) {
                match ($data['action']) {
                    'approve' => $business->status === Business::PENDING && $this->businesses->approve($business, $request->user()),
                    'suspend' => $this->businesses->suspend($business, $data['note']),
                    'delete' => $business->delete(),
                };
                $count++;
            }
        });

        $done = ['approve' => 'approved', 'suspend' => 'taken off the map', 'delete' => 'deleted'][$data['action']];

        return response()->json(['message' => $count === 1 ? "1 place {$done}." : "{$count} places {$done}."]);
    }

    public function addPhoto(Request $request, Business $business): JsonResponse
    {
        $data = $request->validate(['photo' => ['required', 'image', 'max:8192'], 'collection' => ['required', Rule::in(['gallery', 'logo'])], 'alt' => ['nullable', 'string', 'max:200']]);
        $media = $this->businesses->addPhoto($business, $request->file('photo'), $data['collection'], $request->user(), $data['alt'] ?? null);

        return response()->json(['message' => $data['collection'] === 'logo' ? 'Logo updated.' : 'Photo added.', 'data' => $media->toPublic()], 201);
    }

    public function removePhoto(Business $business, string $media): JsonResponse
    {
        $this->businesses->removePhoto($business, $media);

        return response()->json(['message' => 'Photo removed.']);
    }

    public function reorderPhotos(Request $request, Business $business): JsonResponse
    {
        $this->businesses->reorderPhotos($business, $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['string']])['ids']);

        return response()->json(['message' => 'New order saved.']);
    }

    /** DELETE /admin/directory/businesses/{id}/members/{user} */
    public function removeMember(Business $business, User $user): JsonResponse
    {
        $business->members()->detach($user->id);
        if (! $business->members()->exists()) {
            $business->forceFill(['is_claimed' => false])->save();
        }

        return response()->json(['message' => "{$user->name} no longer manages this place."]);
    }

    /** GET /admin/directory/geocode?q= */
    public function geocode(Request $request, Geocoder $geocoder): JsonResponse
    {
        return response()->json(['data' => $geocoder->search((string) $request->query('q'))]);
    }

    /** Districts and localities with their centre, for pickers and the map. */
    public function areas(): JsonResponse
    {
        $districts = Area::whereNull('parent_id')->with('children')->orderBy('position')->get();
        $shape = fn (Area $a) => ['slug' => $a->slug, 'name' => $a->getTranslation('name', 'en'), 'latitude' => $a->latitude, 'longitude' => $a->longitude];

        return response()->json(['data' => $districts->map(fn (Area $d) => $shape($d) + ['children' => $d->children->map($shape)->all()])]);
    }

    private function authorizeClaims(Request $request): ?string
    {
        if (! $request->user()->can('directory.claims')) {
            throw new FriendlyException('Approving new places needs the “Approve new places and ownership claims” permission.', 'FORBIDDEN', 403);
        }

        return null;
    }

    private function validated(Request $request, ?Business $business = null): array
    {
        return $request->validate([
            'sector' => ['required', 'string', 'exists:sectors,slug'],
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash'],
            'description' => ['nullable', 'string', 'max:3000'],
            'ssm_number' => ['nullable', 'string', 'max:40'],
            'status' => [$business ? 'prohibited' : 'nullable', Rule::in(Business::STATUSES)],
            'details' => ['nullable', 'array'],
            'contacts' => ['nullable', 'array'],
            'contacts.*' => ['nullable', 'string', 'max:190'],
            'contacts.email' => ['nullable', 'email', 'max:190'],
            'locations' => ['required', 'array', 'min:1', 'max:50'],
            'locations.*.id' => ['nullable', 'string'],
            'locations.*.label' => ['nullable', 'string', 'max:120'],
            'locations.*.address' => ['required', 'string', 'max:300'],
            'locations.*.postcode' => ['nullable', 'string', 'max:10'],
            'locations.*.area' => ['nullable', 'string', 'exists:areas,slug'],
            'locations.*.latitude' => ['required', 'numeric', 'between:-90,90'],
            'locations.*.longitude' => ['required', 'numeric', 'between:-180,180'],
            'locations.*.phone' => ['nullable', 'string', 'max:30'],
            'locations.*.hours_note' => ['nullable', 'string', 'max:200'],
            'locations.*.is_primary' => ['boolean'],
            'locations.*.hours' => ['nullable', 'array'],
        ], [
            'name.required' => 'Please give the place a name.',
            'sector.required' => 'Please choose a sector.',
            'locations.required' => 'Please add at least one address.',
            'locations.*.address.required' => 'Please fill in the address.',
            'locations.*.latitude.required' => 'Please put the pin on the map.',
        ]);
    }
}
