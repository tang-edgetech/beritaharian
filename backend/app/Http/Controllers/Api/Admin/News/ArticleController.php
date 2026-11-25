<?php

namespace App\Http\Controllers\Api\Admin\News;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\News\ArticleResource;
use App\Models\News\Article;
use App\Models\News\ArticleSource;
use App\Services\MediaService;
use App\Services\News\ArticleService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

class ArticleController extends Controller
{
    public function __construct(private ArticleService $articles) {}

    /** GET /admin/news/articles?filter[q]=&filter[status]=&filter[category]=&filter[mine]=yes&filter[queue]=review&sort=-updated_at */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $base = Article::query()->with(['author', 'category', 'area', 'cover'])
            // journalists without wider rights only see their own stories
            ->when(! $user->canAny(['news.edit_any', 'news.verify', 'news.publish']), fn (Builder $q) => $q->where('author_id', $user->id));

        $articles = QueryBuilder::for($base)
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('title', 'like', "%{$value}%")->orWhere('slug', 'like', '%'.str($value)->slug().'%'))),
                AllowedFilter::callback('status', fn (Builder $q, $value) => $value === 'live' ? $q->live() : $q->whereIn('status', (array) $value)),
                AllowedFilter::callback('category', fn (Builder $q, $value) => $q->whereHas('category', fn (Builder $c) => $c->where('slug', $value))),
                AllowedFilter::callback('area', fn (Builder $q, $value) => $q->whereHas('area', fn (Builder $a) => $a->where('slug', $value))),
                AllowedFilter::callback('mine', fn (Builder $q, $value) => $value === 'yes' ? $q->where('author_id', $user->id) : $q),
                AllowedFilter::callback('breaking', fn (Builder $q, $value) => $q->where('is_breaking', $value === 'yes')),
                AllowedFilter::callback('label', fn (Builder $q, $value) => $q->where('truth_label', $value)),
                // what is waiting for me: verifiers see stories in review, editors see verified ones too
                AllowedFilter::callback('queue', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->when($user->can('news.verify'), fn (Builder $x) => $x->orWhere('status', Article::IN_REVIEW)
                        ->orWhere(fn (Builder $y) => $y->live()->where('truth_label', Article::LABEL_DEVELOPING)))
                    ->when($user->can('news.publish'), fn (Builder $x) => $x->orWhere('status', Article::VERIFIED)))),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('created_at', 'updated_at', 'published_at', AllowedSort::field('views', 'view_count'))
            ->defaultSort('-updated_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return ArticleResource::collection($articles);
    }

    /** Counts for the newsroom menu badges. */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['data' => [
            'to_verify' => $user->can('news.verify') ? Article::where('status', Article::IN_REVIEW)->where('author_id', '!=', $user->id)->count()
                + Article::live()->where('truth_label', Article::LABEL_DEVELOPING)->count() : 0,
            'to_publish' => $user->can('news.publish') ? Article::where('status', Article::VERIFIED)->count() : 0,
            'my_drafts' => Article::where('author_id', $user->id)->where('status', Article::DRAFT)->count(),
            'sent_back' => Article::where('author_id', $user->id)->where('status', Article::DRAFT)->whereNotNull('review_note')->count(),
            'live_today' => Article::live()->where('published_at', '>=', today())->count(),
        ]]);
    }

    public function show(Request $request, Article $article): ArticleResource
    {
        $this->ensureCanSee($request, $article);

        return (new ArticleResource($article->load(['author', 'category', 'area', 'cover', 'tags', 'sources', 'verifier', 'publisher'])))->full();
    }

    public function store(Request $request): JsonResponse
    {
        $article = $this->articles->save(null, $this->validated($request), $request->user());

        return response()->json([
            'message' => 'Draft saved.',
            'data' => (new ArticleResource($article->load(['author', 'category', 'area', 'cover', 'tags', 'sources'])))->full(),
        ], 201);
    }

    public function update(Request $request, Article $article): JsonResponse
    {
        $article = $this->articles->save($article, $this->validated($request, $article), $request->user());

        return response()->json([
            'message' => $article->isLive() ? 'Changes are live.' : 'Draft saved.',
            'data' => (new ArticleResource($article->load(['author', 'category', 'area', 'cover', 'tags', 'sources'])))->full(),
        ]);
    }

    public function destroy(Request $request, Article $article): JsonResponse
    {
        $this->articles->delete($article, $request->user());

        return response()->json(['message' => 'Story deleted.']);
    }

    /** POST /admin/news/articles/{id}/workflow { action, note?, publish_at? } */
    public function workflow(Request $request, Article $article): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['submit', 'send_back', 'verify', 'publish', 'publish_breaking', 'reject', 'archive', 'restore', 'feature', 'unfeature'])],
            'note' => [Rule::requiredIf(in_array($request->input('action'), ['send_back', 'reject', 'archive'], true)), 'nullable', 'string', 'max:1000'],
            'publish_at' => ['nullable', 'date'],
        ], ['note.required' => 'Please write a short note so the writer knows why.']);

        $user = $request->user();
        $at = isset($data['publish_at']) ? Carbon::parse($data['publish_at']) : null;

        $message = match ($data['action']) {
            'submit' => tap('Sent for review. A verifier will check the facts.', fn () => $this->articles->submit($article, $user)),
            'send_back' => tap('Sent back to the writer with your note.', fn () => $this->articles->sendBack($article, $data['note'], $user)),
            'verify' => tap($article->isLive() ? 'Verified. The "developing" label is removed.' : 'Verified. An editor can publish it now.', fn () => $this->articles->verify($article, $user, $data['note'] ?? null)),
            'publish' => tap($at && $at->isFuture() ? 'Scheduled for '.$at->timezone(config('app.timezone'))->format('j M, g:i a').'.' : 'Published. It is live on the site.', fn () => $this->articles->publish($article, $user, $at)),
            'publish_breaking' => tap('Published as breaking news with a "developing" label.', fn () => $this->articles->publish($article, $user, null, true)),
            'reject' => tap('Story rejected and archived.', fn () => $this->articles->reject($article, $data['note'], $user)),
            'archive' => tap('Taken off the site.', fn () => $this->articles->archive($article, $data['note'], $user)),
            'restore' => tap('Restored to a draft.', fn () => $this->articles->restore($article, $user)),
            'feature' => tap('This is now the lead story.', fn () => $this->articles->feature($article, true, $user)),
            'unfeature' => tap('No longer the lead story.', fn () => $this->articles->feature($article, false, $user)),
        };

        return response()->json([
            'message' => $message,
            'data' => (new ArticleResource($article->fresh()->load(['author', 'category', 'area', 'cover', 'tags', 'sources', 'verifier', 'publisher'])))->full(),
        ]);
    }

    /** POST /admin/news/articles/bulk { action: submit|archive|delete, ids[], note? } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['archive', 'delete', 'restore'])],
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['string'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $user = $request->user();
        $done = 0;
        foreach (Article::whereIn('ulid', $data['ids'])->get() as $article) {
            try {
                DB::transaction(fn () => match ($data['action']) {
                    'archive' => $this->articles->archive($article, $data['note'] ?: 'Taken off the site in bulk', $user),
                    'delete' => $this->articles->delete($article, $user),
                    'restore' => $this->articles->restore($article, $user),
                });
                $done++;
            } catch (FriendlyException) {
                // not allowed for this one: counted as skipped
            }
        }
        $skipped = count($data['ids']) - $done;
        $verb = ['archive' => 'taken off the site', 'delete' => 'deleted', 'restore' => 'restored to drafts'][$data['action']];
        $message = ($done === 1 ? '1 story ' : "{$done} stories ").$verb.'.'.($skipped ? " {$skipped} skipped because that isn't possible for them." : '');

        return response()->json(['message' => $message, 'affected' => $done, 'skipped' => $skipped]);
    }

    public function revisions(Request $request, Article $article): JsonResponse
    {
        $this->ensureCanSee($request, $article);

        return response()->json(['data' => $article->revisions()->with('editor')->limit(100)->get()->map(fn ($r) => [
            'id' => $r->id,
            'editor' => $r->editor?->name ?? 'Someone',
            'change_note' => $r->change_note,
            'is_public_correction' => $r->is_public_correction,
            'snapshot' => $r->snapshot,
            'created_at' => $r->created_at?->toIso8601String(),
        ])]);
    }

    /** POST /admin/news/media (multipart: image, alt?) — a picture for a cover or inside the story. */
    public function upload(Request $request, MediaService $media): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240', 'dimensions:min_width=400'],
            'alt' => ['nullable', 'string', 'max:200'],
            'collection' => ['nullable', Rule::in(['cover', 'inline'])],
        ], [
            'image.max' => 'The picture must be smaller than 10 MB.',
            'image.dimensions' => 'The picture is too small. Use one at least 400 pixels wide.',
            'image.mimes' => 'Please use a JPG, PNG or WebP picture.',
        ]);

        $item = $media->storeImage($request->file('image'), $data['collection'] ?? 'inline', $request->user(), ['alt' => $data['alt'] ?? '']);

        return response()->json(['message' => 'Picture uploaded.', 'data' => $item->toPublic()], 201);
    }

    private function ensureCanSee(Request $request, Article $article): void
    {
        $user = $request->user();
        if ($article->author_id !== $user->id && ! $user->canAny(['news.edit_any', 'news.verify', 'news.publish'])) {
            throw new FriendlyException('You can only open your own stories.', 'FORBIDDEN', 403);
        }
    }

    private function validated(Request $request, ?Article $article = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'excerpt' => ['nullable', 'string', 'max:300'],
            'body' => ['nullable', 'array'],
            'category' => ['nullable', 'string', 'exists:categories,slug'],
            'area' => ['nullable', 'string', 'exists:areas,slug'],
            'tags' => ['nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:60'],
            'sources' => ['nullable', 'array', 'max:20'],
            'sources.*.kind' => ['required', Rule::in(array_keys(ArticleSource::KINDS))],
            'sources.*.label' => ['required', 'string', 'max:190'],
            'sources.*.url' => ['nullable', 'url:http,https', 'max:500'],
            'cover' => ['nullable', 'string', 'exists:media,ulid'],
            'cover_alt' => ['nullable', 'string', 'max:200'],
            'cover_caption' => ['nullable', 'string', 'max:300'],
            'cover_credit' => ['nullable', 'string', 'max:120'],
            'is_breaking' => ['boolean'],
            'change_note' => ['nullable', 'string', 'max:255'],
            'is_correction' => ['boolean'],
        ], [
            'title.required' => 'Please write a headline.',
            'excerpt.max' => 'Keep the summary under 300 characters.',
            'sources.*.label.required' => 'Each source needs a name, e.g. "JKR Melaka statement".',
            'sources.*.url.url' => 'Source links must start with http:// or https://.',
        ]);
    }
}
