<?php

namespace App\Http\Controllers\Api\Admin\Directory;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Directory\Present;
use App\Models\Directory\Review;
use App\Services\Directory\ReviewService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Review moderation: receipts to check, flagged reviews, and reports from owners and readers. */
class ReviewController extends Controller
{
    private const WITH = ['business.sector', 'user', 'moderator', 'proof', 'photos', 'reply', 'location'];

    public function __construct(private ReviewService $reviews) {}

    /** GET /admin/directory/reviews?filter[queue]=check|reported&filter[status]=&filter[proof]=&filter[place]=&filter[q]=&filter[rating]= */
    public function index(Request $request): JsonResponse
    {
        $page = QueryBuilder::for(Review::query()->with(self::WITH))
            ->allowedFilters(
                AllowedFilter::callback('queue', fn (Builder $q, $value) => match ($value) {
                    'check' => $q->whereIn('status', [Review::PENDING, Review::HELD]),
                    'reported' => $q->where('status', Review::VISIBLE)->where('open_reports', '>', 0),
                    default => $q,
                }),
                AllowedFilter::callback('status', fn (Builder $q, $value) => $q->whereIn('status', (array) $value)),
                AllowedFilter::callback('proof', fn (Builder $q, $value) => $q->whereHas('proof', fn (Builder $p) => $p->where('kind', $value))),
                AllowedFilter::callback('place', fn (Builder $q, $value) => $q->whereHas('business', fn (Builder $b) => $b->where('ulid', $value))),
                AllowedFilter::callback('rating', fn (Builder $q, $value) => $q->where('rating', (int) $value)),
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('body', 'like', "%{$value}%")->orWhere('title', 'like', "%{$value}%")
                    ->orWhereHas('business', fn (Builder $b) => $b->where('search_text', 'like', "%{$value}%"))
                    ->orWhereHas('user', fn (Builder $u) => $u->where('name', 'like', "%{$value}%")->orWhere('email', 'like', "%{$value}%")))),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('created_at', 'rating', AllowedSort::field('reports', 'open_reports'), AllowedSort::field('helpful', 'helpful_count'))
            ->defaultSort('created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Review $r) => Present::adminReview($r)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    public function show(Review $review): JsonResponse
    {
        return response()->json(['data' => Present::adminReview($review->load([...self::WITH, 'reports.user']), true)]);
    }

    /** POST /admin/directory/reviews/{review}/moderate { action: approve|return|remove|restore|dismiss_reports, note? } */
    public function moderate(Request $request, Review $review): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'return', 'remove', 'restore', 'dismiss_reports'])],
            'note' => [Rule::requiredIf(in_array($request->input('action'), ['return', 'remove'], true)), 'nullable', 'string', 'max:1000'],
        ], ['note.required' => 'Please write a short reason. The writer will see it.']);
        $user = $request->user();

        $message = match ($data['action']) {
            'approve' => tap('Approved. The review is on the place page.', fn () => $this->reviews->approve($review, $user, $data['note'] ?? null)),
            'return' => tap('Sent back to the writer with your reason.', fn () => $this->reviews->returnToWriter($review, $user, $data['note'])),
            'remove' => tap('Review taken down.', fn () => $this->reviews->remove($review, $user, $data['note'])),
            'restore' => tap('Review put back.', fn () => $this->reviews->restore($review, $user)),
            'dismiss_reports' => tap('Reports closed. The review stays up.', fn () => $this->reviews->dismissReports($review, $user)),
        };

        return response()->json(['message' => $message, 'data' => Present::adminReview($review->fresh()->load([...self::WITH, 'reports.user']), true)]);
    }

    /** POST /admin/directory/reviews/bulk { action: approve|remove, ids[], note? } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'remove'])],
            'ids' => ['required', 'array', 'max:100'],
            'ids.*' => ['string'],
            'note' => ['required_if:action,remove', 'nullable', 'string', 'max:1000'],
        ], ['note.required_if' => 'Please write a short reason. The writers will see it.']);
        $count = 0;
        foreach (Review::whereIn('ulid', $data['ids'])->get() as $review) {
            if ($data['action'] === 'approve' && in_array($review->status, [Review::PENDING, Review::HELD], true)) {
                $this->reviews->approve($review, $request->user());
                $count++;
            } elseif ($data['action'] === 'remove' && $review->status === Review::VISIBLE) {
                $this->reviews->remove($review, $request->user(), $data['note']);
                $count++;
            }
        }
        $done = $data['action'] === 'approve' ? 'approved' : 'taken down';

        return response()->json(['message' => $count === 1 ? "1 review {$done}." : "{$count} reviews {$done}."]);
    }

    /** The receipt photo, for moderators only. */
    public function receipt(Review $review): StreamedResponse
    {
        $path = $review->proof?->path;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            throw new FriendlyException('The receipt photo is no longer kept (they are deleted 90 days after the check).', 'NO_FILE', 404);
        }

        return Storage::disk('local')->response($path, "receipt-{$review->ulid}.".pathinfo($path, PATHINFO_EXTENSION));
    }
}
