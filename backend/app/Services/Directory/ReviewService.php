<?php

namespace App\Services\Directory;

use App\Exceptions\FriendlyException;
use App\Models\Directory\Business;
use App\Models\Directory\Review;
use App\Models\Directory\ReviewReport;
use App\Models\Directory\ReviewVote;
use App\Models\Directory\VisitProof;
use App\Models\User;
use App\Services\MediaService;
use App\Services\SettingService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Reviews after a visit. Flow:
 *  check-in within range  → shown at once with "Verified visit"
 *  receipt photo          → waits for a moderator (pending)
 *  automatic checks flag  → held for a moderator, whatever the proof
 * Owners can reply and report, never delete.
 */
class ReviewService
{
    public function __construct(private BusinessService $businesses, private MediaService $media, private SettingService $settings) {}

    /** @param  UploadedFile[]  $photos */
    public function write(Business $business, User $user, array $data, ?UploadedFile $receipt, array $photos = []): Review
    {
        if ($business->status !== Business::ACTIVE) {
            throw new FriendlyException('This place is not taking reviews right now.', 'NOT_REVIEWABLE');
        }
        if ($business->isManagedBy($user)) {
            throw new FriendlyException('You manage this place, so you can reply to reviews but not write one.', 'OWN_BUSINESS');
        }
        if (Review::where('business_id', $business->id)->where('user_id', $user->id)->whereNot('status', Review::RETURNED)->exists()) {
            throw new FriendlyException('You have already reviewed this place. You can delete your review and write a new one.', 'ALREADY_REVIEWED');
        }
        $perDay = (int) $this->settings->get('directory', 'reviews_per_day', 5);
        if (Review::withTrashed()->where('user_id', $user->id)->where('created_at', '>=', now()->subDay())->count() >= $perDay) {
            throw new FriendlyException('You have written a lot of reviews today. Please try again tomorrow.', 'REVIEW_LIMIT', 429);
        }

        $location = isset($data['location']) ? $business->locations()->where('ulid', $data['location'])->first() : null;
        $proof = ['kind' => $data['proof'], 'status' => 'pending'];

        if ($data['proof'] === VisitProof::CHECKIN) {
            // nearest branch to where the reviewer is standing
            $lat = (float) $data['latitude'];
            $lng = (float) $data['longitude'];
            $nearest = $business->locations()->get()->sortBy(fn ($l) => $l->distanceTo($lat, $lng))->first();
            $distance = $nearest?->distanceTo($lat, $lng);
            $radius = (int) $this->settings->get('directory', 'checkin_radius_m', 150);
            if ($distance === null || $distance > $radius) {
                $away = $distance >= 1000 ? number_format($distance / 1000, 1).' km' : "{$distance} m";
                throw new FriendlyException("Check-in only works at the place itself. You seem to be about {$away} away. You can add a receipt photo instead.", 'TOO_FAR');
            }
            $location = $nearest;
            $proof = array_merge($proof, ['latitude' => $lat, 'longitude' => $lng, 'distance_m' => $distance, 'status' => 'confirmed', 'verified_at' => now()]);
        } elseif (! $receipt) {
            throw new FriendlyException('Please add a photo of your receipt, or check in at the place.', 'PROOF_NEEDED');
        }

        $flags = $this->autoCheck($user, $data);
        $status = $flags ? Review::HELD : ($proof['status'] === 'confirmed' ? Review::VISIBLE : Review::PENDING);

        $review = DB::transaction(function () use ($business, $user, $data, $location, $proof, $flags, $status, $receipt) {
            $review = Review::create([
                'business_id' => $business->id,
                'business_location_id' => $location?->id,
                'user_id' => $user->id,
                'rating' => (int) $data['rating'],
                'sub_ratings' => collect($data['sub_ratings'] ?? [])->only(Review::SUB_RATINGS)->map(fn ($v) => (int) $v)->filter(fn ($v) => $v >= 1 && $v <= 5)->all() ?: null,
                'title' => $data['title'] ?? null,
                'body' => trim($data['body']),
                'visited_on' => $data['visited_on'],
                'is_anonymous' => (bool) ($data['is_anonymous'] ?? false),
                'status' => $status,
                'flags' => $flags ?: null,
            ]);
            $review->forceFill([
                'is_verified_visit' => $proof['status'] === 'confirmed',
                'published_at' => $status === Review::VISIBLE ? now() : null,
            ])->saveQuietly();

            if ($receipt) {
                $proof['path'] = $receipt->storeAs('directory/receipts', "{$review->ulid}.{$receipt->extension()}", 'local');
            }
            $review->proof()->create($proof);

            return $review;
        });

        foreach (array_slice($photos, 0, 4) as $i => $photo) {
            $media = $this->media->storeImage($photo, 'review', $user, ['alt' => "Photo from a review of {$business->displayName()}"]);
            $media->forceFill(['mediable_type' => $review->getMorphClass(), 'mediable_id' => $review->id, 'position' => $i])->save();
        }

        if ($status === Review::VISIBLE) {
            $this->businesses->refreshRating($business);
        }

        return $review;
    }

    /** Moderator: proof is fine and the text is fine. Shows the review. */
    public function approve(Review $review, User $actor, ?string $note = null): void
    {
        if (! in_array($review->status, [Review::PENDING, Review::HELD], true)) {
            throw new FriendlyException('Only reviews waiting for a check can be approved.', 'NOT_WAITING');
        }
        DB::transaction(function () use ($review, $actor, $note) {
            $proof = $review->proof;
            if ($proof && $proof->status !== 'confirmed') {
                $proof->update(['status' => 'confirmed', 'verified_by' => $actor->id, 'verified_at' => now(), 'purge_after' => $proof->path ? now()->addDays(90) : null]);
            }
            $review->forceFill([
                'status' => Review::VISIBLE,
                'is_verified_visit' => (bool) $proof,
                'published_at' => $review->published_at ?? now(),
                'moderated_by' => $actor->id,
                'moderated_at' => now(),
                'moderation_note' => $note,
            ])->save();
        });
        $this->businesses->refreshRating($review->business);
    }

    /** Moderator: the proof doesn't hold up. The writer sees the reason and may try again. */
    public function returnToWriter(Review $review, User $actor, string $note): void
    {
        if (! in_array($review->status, [Review::PENDING, Review::HELD], true)) {
            throw new FriendlyException('Only reviews waiting for a check can be sent back.', 'NOT_WAITING');
        }
        $review->proof?->update(['status' => 'rejected', 'verified_by' => $actor->id, 'verified_at' => now()]);
        $this->deleteReceipt($review);
        $review->forceFill(['status' => Review::RETURNED, 'moderated_by' => $actor->id, 'moderated_at' => now(), 'moderation_note' => $note])->save();
    }

    /** Moderator: take a shown review down (breaks the rules). Open reports are closed with it. */
    public function remove(Review $review, User $actor, string $note): void
    {
        $review->forceFill(['status' => Review::REMOVED, 'moderated_by' => $actor->id, 'moderated_at' => now(), 'moderation_note' => $note])->save();
        $this->resolveReports($review, $actor);
        $this->businesses->refreshRating($review->business);
    }

    /** Moderator: undo a removal. */
    public function restore(Review $review, User $actor): void
    {
        if ($review->status !== Review::REMOVED) {
            throw new FriendlyException('Only removed reviews can be put back.', 'NOT_REMOVED');
        }
        $confirmed = $review->proof?->status === 'confirmed';
        $review->forceFill(['status' => $confirmed ? Review::VISIBLE : Review::PENDING, 'moderated_by' => $actor->id, 'moderated_at' => now(), 'moderation_note' => null])->save();
        $this->businesses->refreshRating($review->business);
    }

    /** Moderator: reports checked, the review stays. */
    public function dismissReports(Review $review, User $actor): void
    {
        $this->resolveReports($review, $actor);
    }

    public function reply(Review $review, User $owner, string $body): void
    {
        $this->ensureManager($review, $owner);
        if ($review->status !== Review::VISIBLE) {
            throw new FriendlyException('You can reply once the review is shown on the site.', 'NOT_VISIBLE');
        }
        $review->reply()->updateOrCreate([], ['user_id' => $owner->id, 'body' => trim($body)]);
        $this->businesses->refreshRating($review->business); // refreshes the page cache too
    }

    public function deleteReply(Review $review, User $owner): void
    {
        $this->ensureManager($review, $owner);
        $review->reply()->delete();
        $this->businesses->refreshRating($review->business);
    }

    /** @return array{helpful: bool, count: int} */
    public function toggleHelpful(Review $review, User $user): array
    {
        if ($review->status !== Review::VISIBLE || $review->user_id === $user->id) {
            throw new FriendlyException('You can only mark other people’s reviews as helpful.', 'CANNOT_VOTE');
        }
        $vote = ReviewVote::where('review_id', $review->id)->where('user_id', $user->id)->first();
        $vote ? $vote->delete() : ReviewVote::create(['review_id' => $review->id, 'user_id' => $user->id]);
        $review->forceFill(['helpful_count' => ReviewVote::where('review_id', $review->id)->count()])->saveQuietly();

        return ['helpful' => ! $vote, 'count' => $review->helpful_count];
    }

    public function report(Review $review, User $user, string $reason, ?string $note): void
    {
        if ($review->status !== Review::VISIBLE || $review->user_id === $user->id) {
            throw new FriendlyException('This review can’t be reported.', 'CANNOT_REPORT');
        }
        if (ReviewReport::where('review_id', $review->id)->where('user_id', $user->id)->exists()) {
            throw new FriendlyException('You have already reported this review. A moderator will look at it.', 'ALREADY_REPORTED');
        }
        ReviewReport::create(['review_id' => $review->id, 'user_id' => $user->id, 'reason' => $reason, 'note' => $note, 'status' => 'open']);
        $review->forceFill(['open_reports' => $review->reports()->where('status', 'open')->count()])->saveQuietly();
    }

    /** The writer deletes their own review. */
    public function deleteOwn(Review $review, User $user): void
    {
        if ($review->user_id !== $user->id) {
            throw new FriendlyException('You can only delete your own reviews.', 'NOT_YOURS', 403);
        }
        $wasVisible = $review->status === Review::VISIBLE;
        $this->deleteReceipt($review);
        $review->delete();
        if ($wasVisible) {
            $this->businesses->refreshRating($review->business);
        }
    }

    /** Daily: receipt photos are deleted 90 days after the check. */
    public function purgeReceipts(): int
    {
        $count = 0;
        VisitProof::whereNotNull('path')->where('purge_after', '<=', now())->each(function (VisitProof $proof) use (&$count) {
            Storage::disk('local')->delete($proof->path);
            $proof->update(['path' => null]);
            $count++;
        });

        return $count;
    }

    /** Blocked words, links, phone numbers and e-mails, copy-paste. @return string[] */
    private function autoCheck(User $user, array $data): array
    {
        $text = Str::lower(($data['title'] ?? '').' '.$data['body']);
        $flags = [];
        $words = collect($this->settings->get('directory', 'blocked_words', []))->map(fn ($w) => Str::lower(trim((string) $w)))->filter();
        if ($words->contains(fn ($w) => preg_match('/\b'.preg_quote($w, '/').'\b/u', $text))) {
            $flags[] = 'blocked_words';
        }
        if (preg_match('~https?://|www\.~i', $text)) {
            $flags[] = 'link';
        }
        if (preg_match('/[\w.+-]+@[\w-]+\.[\w.]+/', $text) || preg_match('/(\+?6?01)[0-46-9][-\s]?\d{3,4}[-\s]?\d{4}/', $text)) {
            $flags[] = 'personal_info';
        }
        if (Review::withTrashed()->where('user_id', $user->id)->where('body', trim($data['body']))->exists()) {
            $flags[] = 'duplicate';
        }

        return $flags;
    }

    private function resolveReports(Review $review, User $actor): void
    {
        $review->reports()->where('status', 'open')->update(['status' => 'resolved', 'resolved_by' => $actor->id, 'resolved_at' => now()]);
        $review->forceFill(['open_reports' => 0])->saveQuietly();
    }

    private function deleteReceipt(Review $review): void
    {
        $proof = $review->proof;
        if ($proof?->path) {
            Storage::disk('local')->delete($proof->path);
            $proof->update(['path' => null]);
        }
    }

    private function ensureManager(Review $review, User $user): void
    {
        if (! $review->business->isManagedBy($user)) {
            throw new FriendlyException('Only the people who manage this place can reply.', 'NOT_MANAGER', 403);
        }
    }

    public static function visitedRule(): array
    {
        return ['required', 'date', 'before_or_equal:today', 'after_or_equal:'.Carbon::today()->subYear()->toDateString()];
    }
}
