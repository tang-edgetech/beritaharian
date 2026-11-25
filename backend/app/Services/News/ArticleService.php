<?php

namespace App\Services\News;

use App\Exceptions\FriendlyException;
use App\Models\Area;
use App\Models\Media;
use App\Models\News\Article;
use App\Models\News\Category;
use App\Models\Tag;
use App\Models\User;
use App\Services\MediaService;
use App\Support\RichText;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Every change to a story goes through here, so the newsroom rules live in one place:
 * - journalists edit their own drafts; editors can edit anything
 * - a verifier checks facts before an editor publishes, and can't verify their own story
 * - breaking news can be published first with a "developing" label and verified afterwards
 * - changes to a live story need a note, and public corrections are shown under the story
 */
class ArticleService
{
    public function __construct(private MediaService $media) {}

    // ---------------------------------------------------------------- permissions

    public function canEdit(User $user, Article $article): bool
    {
        if ($article->status === Article::ARCHIVED) {
            return false;
        }
        if ($user->can('news.edit_any')) {
            return true;
        }

        return $user->can('news.write') && $article->author_id === $user->id && $article->isEditableByAuthor();
    }

    /** What this person may do with the story right now; the admin uses it to show the right buttons. */
    public function allowedActions(User $user, Article $article): array
    {
        $own = $article->author_id === $user->id;
        $s = $article->status;

        return array_keys(array_filter([
            'edit' => $this->canEdit($user, $article),
            'submit' => $s === Article::DRAFT && ($user->can('news.edit_any') || ($own && $user->can('news.write'))),
            'send_back' => in_array($s, [Article::IN_REVIEW, Article::VERIFIED], true) && ($user->can('news.verify') || $user->can('news.publish')),
            'verify' => ($s === Article::IN_REVIEW || ($article->isLive() && $article->truth_label === Article::LABEL_DEVELOPING))
                && $user->can('news.verify') && ! $own,
            'publish' => $s === Article::VERIFIED && $user->can('news.publish'),
            'publish_breaking' => in_array($s, [Article::DRAFT, Article::IN_REVIEW], true) && $user->can('news.publish'),
            'reject' => in_array($s, [Article::DRAFT, Article::IN_REVIEW, Article::VERIFIED], true) && $user->can('news.publish') && ! ($own && $s === Article::DRAFT),
            'archive' => in_array($s, [Article::PUBLISHED, Article::SCHEDULED], true) && $user->can('news.publish'),
            'feature' => $article->isLive() && $user->can('news.publish'),
            'restore' => $s === Article::ARCHIVED && $user->can('news.publish'),
            'delete' => in_array($s, [Article::DRAFT, Article::ARCHIVED], true) && ($user->can('news.delete') || ($own && $s === Article::DRAFT && $article->published_at === null)),
        ]));
    }

    private function ensure(User $user, Article $article, string $action): void
    {
        if (! in_array($action, $this->allowedActions($user, $article), true)) {
            throw new FriendlyException(match ($action) {
                'verify' => $article->author_id === $user->id
                    ? 'You wrote this story, so someone else needs to verify it.'
                    : 'Only stories waiting for review can be verified.',
                'publish' => 'This story needs to be verified before it can be published. For urgent news, use "Publish as breaking".',
                'edit' => $article->status === Article::ARCHIVED
                    ? 'This story is archived. Restore it to a draft first.'
                    : 'You can only change your own stories while they are drafts.',
                default => 'That can\'t be done to this story right now.',
            }, 'NOT_ALLOWED', 403);
        }
    }

    // ---------------------------------------------------------------- content

    /**
     * @param  array{title: string, excerpt?: ?string, body?: ?array, category?: ?string, area?: ?string, tags?: array,
     *     sources?: array, cover?: ?string, cover_alt?: ?string, cover_caption?: ?string, cover_credit?: ?string,
     *     is_breaking?: bool, change_note?: ?string, is_correction?: bool}  $data
     */
    public function save(?Article $article, array $data, User $user): Article
    {
        if ($article) {
            $this->ensure($user, $article, 'edit');
        }
        $live = $article?->isLive() ?? false;
        if ($live && blank($data['change_note'] ?? null)) {
            throw new FriendlyException('This story is live. Please write a short note saying what you changed.', 'VALIDATION_FAILED');
        }

        return DB::transaction(function () use ($article, $data, $user, $live) {
            $article ??= new Article(['author_id' => $user->id]);
            if (! $article->exists) {
                $article->status = Article::DRAFT;
            }

            $body = RichText::clean($data['body'] ?? null, $this->media->baseUrl());
            $text = RichText::toText($body);
            $title = trim($data['title']);

            $article->setTranslation('title', 'en', $title);
            $article->setTranslation('excerpt', 'en', trim((string) ($data['excerpt'] ?? '')));
            $article->setTranslation('body', 'en', $body);
            $article->category_id = isset($data['category']) ? Category::where('slug', $data['category'])->value('id') : null;
            $article->area_id = isset($data['area']) ? Area::where('slug', $data['area'])->value('id') : null;
            $article->is_breaking = (bool) ($data['is_breaking'] ?? false);
            $article->search_text = $title."\n".($data['excerpt'] ?? '')."\n".$text;
            $article->reading_minutes = max(1, (int) ceil(RichText::wordCount($text) / 200));

            // the link stays the same once readers have seen it
            if (! $article->published_at) {
                $article->slug = $this->uniqueSlug($title, $article->id);
            }

            if ($live && ($data['is_correction'] ?? false)) {
                $article->truth_label = Article::LABEL_CORRECTED;
                $article->corrected_at = now();
            }

            $article->save();

            $article->tags()->sync(Tag::idsFor($data['tags'] ?? []));
            $article->sources()->delete();
            foreach (array_values($data['sources'] ?? []) as $position => $source) {
                $article->sources()->create([
                    'kind' => $source['kind'],
                    'label' => $source['label'],
                    'url' => $source['url'] ?? null,
                    'position' => $position,
                ]);
            }
            $this->attachCover($article, $data);

            $article->revisions()->create([
                'editor_id' => $user->id,
                'snapshot' => $this->snapshot($article->fresh(['category', 'area', 'tags', 'sources'])),
                'change_note' => $data['change_note'] ?? ($article->wasRecentlyCreated ? 'First draft' : null),
                'is_public_correction' => $live && ($data['is_correction'] ?? false),
            ]);

            return $article->fresh();
        });
    }

    private function attachCover(Article $article, array $data): void
    {
        if (! array_key_exists('cover', $data)) {
            return;
        }
        $current = $article->cover;
        $new = $data['cover'] ? Media::where('ulid', $data['cover'])->first() : null;

        if ($current && (! $new || ! $current->is($new))) {
            $current->delete();
        }
        if ($new) {
            if ($new->mediable_id && ! ($new->mediable_type === $article->getMorphClass() && $new->mediable_id === $article->id)) {
                throw new FriendlyException('That picture already belongs to another story. Please upload it again.', 'VALIDATION_FAILED');
            }
            $new->forceFill([
                'mediable_type' => $article->getMorphClass(),
                'mediable_id' => $article->id,
                'collection' => 'cover',
                'meta' => array_merge($new->meta ?? [], [
                    'alt' => $data['cover_alt'] ?? '',
                    'caption' => $data['cover_caption'] ?? null,
                    'credit' => $data['cover_credit'] ?? null,
                ]),
            ])->save();
        }
    }

    private function uniqueSlug(string $title, ?int $ignoreId): string
    {
        $base = Str::limit(Str::slug($title), 120, '') ?: 'story';
        $slug = $base;
        $n = 2;
        while (Article::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = "{$base}-{$n}";
            $n++;
        }

        return $slug;
    }

    private function snapshot(Article $article): array
    {
        return [
            'title' => $article->getTranslation('title', 'en'),
            'excerpt' => $article->getTranslation('excerpt', 'en', false),
            'body' => $article->getTranslation('body', 'en', false),
            'category' => $article->category?->getTranslation('name', 'en'),
            'area' => $article->area?->getTranslation('name', 'en'),
            'tags' => $article->tags->pluck('name')->all(),
            'sources' => $article->sources->map->only(['kind', 'label', 'url'])->all(),
            'is_breaking' => $article->is_breaking,
        ];
    }

    // ---------------------------------------------------------------- workflow

    public function submit(Article $article, User $user): Article
    {
        $this->ensure($user, $article, 'submit');
        $this->ensureReady($article);
        $this->move($article, Article::IN_REVIEW, ['review_note' => null], 'Sent for review');

        return $article;
    }

    public function sendBack(Article $article, string $note, User $user): Article
    {
        $this->ensure($user, $article, 'send_back');
        $this->move($article, Article::DRAFT, ['review_note' => $note, 'verified_by' => null, 'verified_at' => null], 'Sent back for changes');

        return $article;
    }

    public function verify(Article $article, User $user, ?string $note = null): Article
    {
        $this->ensure($user, $article, 'verify');
        $changes = ['verified_by' => $user->id, 'verified_at' => now(), 'truth_label' => Article::LABEL_VERIFIED, 'review_note' => $note];
        // a live "developing" story keeps its status; it only gains the verified label
        $this->move($article, $article->isLive() ? $article->status : Article::VERIFIED, $changes, 'Facts verified');

        return $article;
    }

    public function publish(Article $article, User $user, ?Carbon $at = null, bool $breaking = false): Article
    {
        $this->ensure($user, $article, $breaking ? 'publish_breaking' : 'publish');
        $this->ensureReady($article);
        $when = $at && $at->isFuture() ? $at : now();

        $this->move($article, $when->isFuture() ? Article::SCHEDULED : Article::PUBLISHED, [
            'published_at' => $when,
            'published_by' => $user->id,
            'is_breaking' => $breaking || $article->is_breaking,
            'truth_label' => $breaking ? Article::LABEL_DEVELOPING : ($article->truth_label ?? Article::LABEL_VERIFIED),
            'review_note' => null,
        ], $when->isFuture() ? 'Scheduled' : ($breaking ? 'Published as breaking news' : 'Published'));

        return $article;
    }

    public function reject(Article $article, string $reason, User $user): Article
    {
        $this->ensure($user, $article, 'reject');
        $this->move($article, Article::ARCHIVED, ['archived_reason' => $reason, 'review_note' => $reason], 'Rejected');

        return $article;
    }

    public function archive(Article $article, string $reason, User $user): Article
    {
        $this->ensure($user, $article, 'archive');
        $this->move($article, Article::ARCHIVED, ['archived_reason' => $reason, 'is_featured' => false], 'Taken off the site');

        return $article;
    }

    public function restore(Article $article, User $user): Article
    {
        $this->ensure($user, $article, 'restore');
        $this->move($article, Article::DRAFT, ['archived_reason' => null, 'verified_by' => null, 'verified_at' => null], 'Restored to draft');

        return $article;
    }

    /** Only one story is the editor's pick for the lead slot at a time. */
    public function feature(Article $article, bool $on, User $user): Article
    {
        $this->ensure($user, $article, 'feature');
        DB::transaction(function () use ($article, $on) {
            if ($on) {
                Article::where('is_featured', true)->whereKeyNot($article->id)->update(['is_featured' => false]);
            }
            $article->forceFill(['is_featured' => $on])->save();
        });

        return $article;
    }

    public function delete(Article $article, User $user): void
    {
        $this->ensure($user, $article, 'delete');
        $article->delete();
    }

    private function ensureReady(Article $article): void
    {
        $missing = [];
        if (blank($article->getTranslation('title', 'en', false))) {
            $missing[] = 'a headline';
        }
        if (! $article->category_id) {
            $missing[] = 'a category';
        }
        if (RichText::wordCount(RichText::toText($article->getTranslation('body', 'en', false) ?: null)) < 30) {
            $missing[] = 'a story of at least 30 words';
        }
        if ($missing) {
            throw new FriendlyException('Before this goes further, add '.implode(', ', $missing).'.', 'ARTICLE_INCOMPLETE');
        }
    }

    private function move(Article $article, string $status, array $changes, string $event): void
    {
        DB::transaction(function () use ($article, $status, $changes, $event) {
            $article->forceFill(['status' => $status] + $changes)->save();
            activity('news')->performedOn($article)->causedBy(auth()->user())->event('workflow')
                ->withProperties(['attributes' => ['status' => $status, 'note' => $changes['review_note'] ?? $changes['archived_reason'] ?? null]])
                ->log($event);
        });
    }
}
