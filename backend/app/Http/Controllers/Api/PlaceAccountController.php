<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Directory\Present;
use App\Models\Directory\Business;
use App\Models\Directory\BusinessClaim;
use App\Models\Directory\Review;
use App\Models\Directory\ReviewReport;
use App\Models\Directory\ReviewVote;
use App\Models\Directory\VisitProof;
use App\Services\Directory\BusinessService;
use App\Services\Directory\ClaimService;
use App\Services\Directory\ReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * What a signed-in reader does with places: write reviews, vote, report, claim or suggest a place.
 * Owners manage their listings and answer reviews here too (the /business pages on the site).
 */
class PlaceAccountController extends Controller
{
    public function __construct(private ReviewService $reviews, private ClaimService $claims, private BusinessService $businesses) {}

    /** GET /me/places/{slug} — my review, my claim and my helpful votes for one place. */
    public function status(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();
        $business = $this->activePlace($slug);
        $review = $business->reviews()->where('user_id', $user->id)->latest()->first();
        $claim = $business->claims()->where('user_id', $user->id)->latest()->first();

        return response()->json(['data' => [
            'my_review' => $review ? Present::myReview($review->load(['business.sector', 'photos', 'reply', 'location', 'proof'])) : null,
            'my_claim' => $claim ? ['status' => $claim->status, 'decision_note' => $claim->decision_note, 'created_at' => $claim->created_at?->toIso8601String()] : null,
            'is_manager' => $business->isManagedBy($user),
            'voted' => ReviewVote::where('review_votes.user_id', $user->id)->whereIn('review_votes.review_id', $business->reviews()->visible()->select('id'))
                ->join('reviews', 'reviews.id', '=', 'review_votes.review_id')->pluck('reviews.ulid'),
            'reported' => ReviewReport::where('review_reports.user_id', $user->id)->whereIn('review_reports.review_id', $business->reviews()->select('id'))
                ->join('reviews', 'reviews.id', '=', 'review_reports.review_id')->pluck('reviews.ulid'),
        ]]);
    }

    /** POST /me/places/{slug}/reviews (multipart) */
    public function writeReview(Request $request, string $slug): JsonResponse
    {
        $business = $this->activePlace($slug);
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'sub_ratings' => ['nullable', 'array'],
            'sub_ratings.*' => ['nullable', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:120'],
            'body' => ['required', 'string', 'min:30', 'max:3000'],
            'visited_on' => ReviewService::visitedRule(),
            'is_anonymous' => ['boolean'],
            'location' => ['nullable', 'string'],
            'proof' => ['required', Rule::in([VisitProof::RECEIPT, VisitProof::CHECKIN])],
            'receipt' => ['required_if:proof,receipt', 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,heic,pdf', 'max:8192'],
            'latitude' => ['required_if:proof,checkin', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_if:proof,checkin', 'nullable', 'numeric', 'between:-180,180'],
            'photos' => ['nullable', 'array', 'max:4'],
            'photos.*' => ['image', 'max:8192'],
        ], [
            'rating.required' => 'Please choose how many stars.',
            'body.min' => 'Please write a little more (at least 30 characters) so others know what it was like.',
            'visited_on.before_or_equal' => 'The visit date can’t be in the future.',
            'visited_on.after_or_equal' => 'Reviews are for visits in the last 12 months.',
            'receipt.required_if' => 'Please add a photo of your receipt.',
            'latitude.required_if' => 'We need your location to check you in. Please allow location access.',
        ]);

        $review = $this->reviews->write($business, $request->user(), $data, $request->file('receipt'), $request->file('photos', []));
        $message = match ($review->status) {
            Review::VISIBLE => 'Thanks! Your review is up, with a “Verified visit” badge.',
            Review::HELD => 'Thanks! A moderator will read your review before it goes up.',
            default => 'Thanks! We’ll check your receipt and put the review up, usually within a day.',
        };

        return response()->json(['message' => $message, 'data' => Present::myReview($review->load(['business.sector', 'photos', 'reply', 'location', 'proof']))], 201);
    }

    /** POST /me/places/{slug}/claims (multipart) */
    public function claim(Request $request, string $slug): JsonResponse
    {
        $business = $this->activePlace($slug);
        $data = $request->validate([
            'role' => ['required', Rule::in(['owner', 'manager'])],
            'ssm_number' => ['required_without:document', 'nullable', 'string', 'max:40'],
            'phone' => ['required', 'string', 'max:30'],
            'note' => ['nullable', 'string', 'max:1000'],
            'document' => ['required_without:ssm_number', 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:8192'],
            'confirm' => ['accepted'],
        ], [
            'ssm_number.required_without' => 'Please give the SSM registration number, or upload a document that shows you run this place.',
            'document.required_without' => 'Please upload a document, or give the SSM registration number.',
            'confirm.accepted' => 'Please confirm that you are allowed to manage this place.',
        ]);
        $this->claims->submit($business, $request->user(), $data, $request->file('document'));

        return response()->json(['message' => 'Claim sent. We’ll check it and email you, usually within two working days.'], 201);
    }

    /** POST /me/places — suggest a new place, or add your own. */
    public function suggest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sector' => ['required', 'string', 'exists:sectors,slug'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'address' => ['required', 'string', 'max:300'],
            'area' => ['nullable', 'string', 'exists:areas,slug'],
            'latitude' => ['required', 'numeric', 'between:1.9,2.6'],
            'longitude' => ['required', 'numeric', 'between:101.9,102.7'],
            'phone' => ['nullable', 'string', 'max:30'],
            'website' => ['nullable', 'string', 'max:190'],
            'is_owner' => ['boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ], [
            'latitude.required' => 'Please put the pin on the map.',
            'latitude.between' => 'For now we only list places in Melaka. Please check the pin.',
            'longitude.between' => 'For now we only list places in Melaka. Please check the pin.',
        ]);
        if (Business::withTrashed()->where('created_by', $request->user()->id)->where('created_at', '>=', now()->subDay())->count() >= 5) {
            throw new FriendlyException('You have suggested a lot of places today. Please try again tomorrow.', 'SUGGEST_LIMIT', 429);
        }
        $this->businesses->suggest($data, $request->user());

        return response()->json(['message' => 'Thanks! A moderator will check the place and add it to the map.'], 201);
    }

    /** GET /me/reviews */
    public function myReviews(Request $request): JsonResponse
    {
        $reviews = Review::where('user_id', $request->user()->id)->with(['business.sector', 'photos', 'reply', 'location', 'proof'])->latest()->paginate(20);

        return response()->json([
            'data' => collect($reviews->items())->map(fn (Review $r) => Present::myReview($r)),
            'meta' => ['current_page' => $reviews->currentPage(), 'last_page' => $reviews->lastPage(), 'total' => $reviews->total(), 'per_page' => $reviews->perPage()],
        ]);
    }

    public function deleteReview(Request $request, Review $review): JsonResponse
    {
        $this->reviews->deleteOwn($review, $request->user());

        return response()->json(['message' => 'Your review is deleted.']);
    }

    public function helpful(Request $request, Review $review): JsonResponse
    {
        $result = $this->reviews->toggleHelpful($review, $request->user());

        return response()->json(['message' => $result['helpful'] ? 'Marked as helpful.' : 'Removed your helpful mark.', 'data' => $result]);
    }

    public function report(Request $request, Review $review): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(Review::REPORT_REASONS))],
            'note' => ['nullable', 'string', 'max:500'],
        ], ['reason.required' => 'Please choose what is wrong with this review.']);
        $this->reviews->report($review, $request->user(), $data['reason'], $data['note'] ?? null);

        return response()->json(['message' => 'Thanks. A moderator will look at this review.']);
    }

    /** GET /me/businesses — places I manage, and my claims. */
    public function myBusinesses(Request $request): JsonResponse
    {
        $user = $request->user();
        $businesses = Business::whereHas('members', fn ($q) => $q->whereKey($user->id))->with(['sector', 'logo', 'locations.area', 'creator'])->orderBy('slug')->get();
        $claims = BusinessClaim::where('user_id', $user->id)->with(['business.sector', 'decider', 'user'])->latest()->limit(20)->get();

        return response()->json(['data' => [
            'places' => $businesses->map(fn (Business $b) => Present::business($b) + [
                'open_reviews' => $b->reviews()->visible()->whereDoesntHave('reply')->count(),
            ]),
            'claims' => $claims->map(fn (BusinessClaim $c) => Present::claim($c)),
        ]]);
    }

    /** GET /me/businesses/{business} */
    public function myBusiness(Request $request, Business $business): JsonResponse
    {
        $this->ensureManager($request, $business);

        return response()->json(['data' => Present::business($business->load(['sector', 'logo', 'photos', 'locations.area', 'locations.hours', 'members', 'creator']), true)
            + ['sector_fields' => $business->sector->fields()]]);
    }

    /** PUT /me/businesses/{business} */
    public function updateMyBusiness(Request $request, Business $business): JsonResponse
    {
        $data = $request->validate([
            'description' => ['nullable', 'string', 'max:3000'],
            'details' => ['nullable', 'array'],
            'contacts' => ['nullable', 'array'],
            'contacts.*' => ['nullable', 'string', 'max:190'],
            'contacts.email' => ['nullable', 'email', 'max:190'],
            'locations' => ['nullable', 'array'],
            'locations.*.id' => ['required', 'string'],
            'locations.*.phone' => ['nullable', 'string', 'max:30'],
            'locations.*.hours_note' => ['nullable', 'string', 'max:200'],
            'locations.*.hours' => ['nullable', 'array'],
        ]);
        $this->businesses->ownerUpdate($business, $data, $request->user());

        return response()->json(['message' => 'Saved. The changes are on your page now.']);
    }

    /** POST /me/businesses/{business}/photos (multipart: photo, collection=gallery|logo) */
    public function addPhoto(Request $request, Business $business): JsonResponse
    {
        $this->ensureManager($request, $business);
        $data = $request->validate(['photo' => ['required', 'image', 'max:8192'], 'collection' => ['required', Rule::in(['gallery', 'logo'])], 'alt' => ['nullable', 'string', 'max:200']]);
        $media = $this->businesses->addPhoto($business, $request->file('photo'), $data['collection'], $request->user(), $data['alt'] ?? null);

        return response()->json(['message' => $data['collection'] === 'logo' ? 'Logo updated.' : 'Photo added.', 'data' => $media->toPublic()], 201);
    }

    public function removePhoto(Request $request, Business $business, string $media): JsonResponse
    {
        $this->ensureManager($request, $business);
        $this->businesses->removePhoto($business, $media);

        return response()->json(['message' => 'Photo removed.']);
    }

    public function reorderPhotos(Request $request, Business $business): JsonResponse
    {
        $this->ensureManager($request, $business);
        $this->businesses->reorderPhotos($business, $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['string']])['ids']);

        return response()->json(['message' => 'New order saved.']);
    }

    /** GET /me/businesses/{business}/reviews?filter=unanswered|all */
    public function businessReviews(Request $request, Business $business): JsonResponse
    {
        $this->ensureManager($request, $business);
        $reviews = $business->reviews()->visible()->with(['user', 'photos', 'reply', 'location'])
            ->when($request->query('filter') === 'unanswered', fn ($q) => $q->whereDoesntHave('reply'))
            ->latest('published_at')->paginate(10);
        $reported = ReviewReport::where('user_id', $request->user()->id)->whereIn('review_id', collect($reviews->items())->pluck('id'))->pluck('review_id');

        return response()->json([
            'data' => collect($reviews->items())->map(fn (Review $r) => Present::review($r) + ['reported' => $reported->contains($r->id)]),
            'meta' => ['current_page' => $reviews->currentPage(), 'last_page' => $reviews->lastPage(), 'total' => $reviews->total(), 'per_page' => $reviews->perPage()],
        ]);
    }

    public function reply(Request $request, Review $review): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:1500']], ['body.required' => 'Please write your reply.']);
        $this->reviews->reply($review, $request->user(), $data['body']);

        return response()->json(['message' => 'Reply posted.']);
    }

    public function deleteReply(Request $request, Review $review): JsonResponse
    {
        $this->reviews->deleteReply($review, $request->user());

        return response()->json(['message' => 'Reply removed.']);
    }

    private function activePlace(string $slug): Business
    {
        return Business::active()->where('slug', $slug)->first()
            ?? throw new FriendlyException('We couldn’t find that place.', 'NOT_FOUND', 404);
    }

    private function ensureManager(Request $request, Business $business): void
    {
        if (! $business->isManagedBy($request->user())) {
            throw new FriendlyException('Only the people who manage this place can open this page.', 'NOT_MANAGER', 403);
        }
    }
}
