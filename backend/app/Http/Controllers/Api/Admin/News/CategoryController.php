<?php

namespace App\Http\Controllers\Api\Admin\News;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\News\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::ordered()->withCount('articles')->get();

        return response()->json(['data' => $categories->map(fn (Category $c) => $this->present($c))]);
    }

    public function show(Category $category): JsonResponse
    {
        return response()->json(['data' => $this->present($category->loadCount('articles'))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $category = new Category(['position' => (int) Category::max('position') + 1]);
        $this->fill($category, $data)->save();

        return response()->json(['message' => "Category “{$data['name']}” added.", 'data' => $this->present($category->loadCount('articles'))], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $this->validated($request, $category);
        $this->fill($category, $data)->save();

        return response()->json(['message' => 'Category saved.', 'data' => $this->present($category->loadCount('articles'))]);
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->articles()->exists()) {
            throw new FriendlyException('Stories still use this category. Move them to another category, or turn this one off instead.', 'CATEGORY_IN_USE');
        }
        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    /** PUT /admin/news/categories/order { slugs: [...] } after drag and drop */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['slugs' => ['required', 'array'], 'slugs.*' => ['string']]);
        DB::transaction(function () use ($data) {
            foreach ($data['slugs'] as $position => $slug) {
                Category::where('slug', $slug)->update(['position' => $position]);
            }
        });

        return response()->json(['message' => 'New order saved.']);
    }

    /** Melaka districts and localities, for pickers. */
    public function areas(): JsonResponse
    {
        $districts = Area::whereNull('parent_id')->with('children')->orderBy('position')->get();

        return response()->json(['data' => $districts->map(fn (Area $d) => [
            'slug' => $d->slug,
            'name' => $d->getTranslation('name', 'en'),
            'children' => $d->children->map(fn (Area $c) => ['slug' => $c->slug, 'name' => $c->getTranslation('name', 'en')])->all(),
        ])]);
    }

    private function fill(Category $category, array $data): Category
    {
        $category->setTranslation('name', 'en', $data['name']);
        $category->setTranslation('description', 'en', $data['description'] ?? '');
        $category->slug = $data['slug'];
        $category->color = $data['color'];
        $category->is_active = $data['is_active'] ?? true;

        return $category;
    }

    private function validated(Request $request, ?Category $category = null): array
    {
        $request->merge(['slug' => Str::slug($request->input('slug') ?: $request->input('name', ''))]);

        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'slug' => ['required', 'string', 'max:80', Rule::unique('categories', 'slug')->ignore($category?->id)],
            'description' => ['nullable', 'string', 'max:300'],
            'color' => ['required', Rule::in(Category::COLORS)],
            'is_active' => ['boolean'],
        ], [
            'name.required' => 'Please give the category a name.',
            'slug.unique' => 'Another category already uses this web address.',
        ]);
    }

    private function present(Category $c): array
    {
        return [
            'slug' => $c->slug,
            'name' => $c->getTranslation('name', 'en'),
            'description' => $c->getTranslation('description', 'en', false) ?: null,
            'color' => $c->color,
            'is_active' => $c->is_active,
            'position' => $c->position,
            'articles_count' => $c->articles_count ?? null,
        ];
    }
}
