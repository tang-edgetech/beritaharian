<?php

namespace App\Http\Controllers\Api\Public;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\News\PublicArticleResource;
use App\Models\Area;
use App\Models\News\Article;
use App\Models\News\Category;
use App\Models\Tag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/** Read-only news for the public site and, later, the mobile app. No sign-in needed. */
class NewsController extends Controller
{
    private const CARD = ['author', 'category', 'area', 'cover'];

    /** Everything the Kopitiam Board home page needs in one call. */
    public function home(): JsonResponse
    {
        $live = fn () => Article::live()->with(self::CARD);

        $lead = $live()->where('is_featured', true)->latest('published_at')->first()
            ?? $live()->latest('published_at')->first();

        // "Hari ini": most read in the last two days, topped up with the newest stories
        $popularIds = DB::table('article_daily_views')->where('day', '>=', today()->subDay()->toDateString())
            ->groupBy('article_id')->orderByRaw('SUM(views) DESC')->limit(10)->pluck('article_id');
        $today = $live()->whereIn('id', $popularIds)->whereKeyNot($lead?->id)->get()
            ->sortBy(fn ($a) => $popularIds->search($a->id))->values();
        if ($today->count() < 5) {
            $today = $today->concat($live()->whereKeyNot($lead?->id)->whereNotIn('id', $today->pluck('id'))
                ->latest('published_at')->limit(5 - $today->count())->get());
        }
        $today = $today->take(5);

        $shown = $today->pluck('id')->push($lead?->id)->filter();
        $sections = Category::ordered()->where('is_active', true)->get()->map(function (Category $category) use ($live, $shown) {
            $items = $live()->where('category_id', $category->id)->whereNotIn('id', $shown)->latest('published_at')->limit(4)->get();

            return $items->isEmpty() ? null : [
                'category' => ['slug' => $category->slug, 'name' => $category->getTranslation('name', 'en'), 'color' => $category->color],
                'articles' => PublicArticleResource::collection($items),
            ];
        })->filter()->values();

        $breaking = $live()->where('is_breaking', true)->where('published_at', '>=', now()->subDay())->latest('published_at')->limit(3)->get();

        return response()->json(['data' => [
            'lead' => $lead ? new PublicArticleResource($lead) : null,
            'today' => PublicArticleResource::collection($today),
            'breaking' => PublicArticleResource::collection($breaking),
            'sections' => $sections,
            'categories' => $this->categoryList(),
        ]]);
    }

    /** GET /public/articles?category=&area=&tag=&q=&page= */
    public function index(Request $request): AnonymousResourceCollection
    {
        $q = trim((string) $request->query('q'));
        $query = Article::live()->with(self::CARD)
            ->when($request->query('category'), fn (Builder $b, $slug) => $b->whereHas('category', fn (Builder $c) => $c->where('slug', $slug)))
            ->when($request->query('area'), function (Builder $b, $slug) {
                $area = Area::where('slug', $slug)->first();
                $b->whereIn('area_id', $area ? $area->selfAndChildIds() : [0]);
            })
            ->when($request->query('tag'), fn (Builder $b, $slug) => $b->whereHas('tags', fn (Builder $t) => $t->where('slug', $slug)));

        if ($q !== '') {
            $query->where(function (Builder $b) use ($q) {
                if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true) && mb_strlen($q) >= 3) {
                    $b->whereFullText('search_text', $q);
                } else {
                    $b->where('search_text', 'like', '%'.$q.'%');
                }
            });
        }

        $perPage = min(24, max(6, (int) $request->query('per_page', 12)));

        return PublicArticleResource::collection($query->latest('published_at')->paginate($perPage)->withQueryString());
    }

    public function show(string $slug): JsonResponse
    {
        $article = Article::live()->with([...self::CARD, 'tags', 'sources', 'corrections'])->where('slug', $slug)->first()
            ?? throw new FriendlyException('We couldn\'t find that story. It may have been moved or taken down.', 'NOT_FOUND', 404);

        $related = Article::live()->with(self::CARD)->whereKeyNot($article->id)
            ->where(fn (Builder $b) => $b->where('category_id', $article->category_id)->orWhere('area_id', $article->area_id))
            ->latest('published_at')->limit(4)->get();

        return response()->json([
            'data' => (new PublicArticleResource($article))->full(),
            'related' => PublicArticleResource::collection($related),
        ]);
    }

    /** POST /public/articles/{slug}/view — counted once per visitor per day by the front end. */
    public function view(string $slug): JsonResponse
    {
        $id = Article::live()->where('slug', $slug)->value('id');
        if ($id) {
            Article::whereKey($id)->increment('view_count');
            $day = today()->toDateString();
            $updated = DB::table('article_daily_views')->where(['article_id' => $id, 'day' => $day])->increment('views');
            if (! $updated) {
                DB::table('article_daily_views')->insertOrIgnore(['article_id' => $id, 'day' => $day, 'views' => 1]);
            }
        }

        return response()->json(['ok' => true]);
    }

    public function categories(): JsonResponse
    {
        return response()->json(['data' => $this->categoryList()]);
    }

    public function areas(): JsonResponse
    {
        $districts = Area::whereNull('parent_id')->with('children')->orderBy('position')->get();

        return response()->json(['data' => $districts->map(fn (Area $d) => [
            'slug' => $d->slug,
            'name' => $d->getTranslation('name', 'en'),
            'children' => $d->children->map(fn (Area $c) => ['slug' => $c->slug, 'name' => $c->getTranslation('name', 'en')])->all(),
        ])]);
    }

    public function tag(string $slug): JsonResponse
    {
        $tag = Tag::where('slug', $slug)->first() ?? throw new FriendlyException('We couldn\'t find that topic.', 'NOT_FOUND', 404);

        return response()->json(['data' => ['name' => $tag->name, 'slug' => $tag->slug]]);
    }

    private function categoryList(): array
    {
        return Category::ordered()->where('is_active', true)->get()->map(fn (Category $c) => [
            'slug' => $c->slug,
            'name' => $c->getTranslation('name', 'en'),
            'description' => $c->getTranslation('description', 'en', false) ?: null,
            'color' => $c->color,
        ])->all();
    }
}
