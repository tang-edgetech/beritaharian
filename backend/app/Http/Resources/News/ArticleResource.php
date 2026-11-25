<?php

namespace App\Http\Resources\News;

use App\Models\News\Article;
use App\Models\News\ArticleSource;
use App\Services\News\ArticleService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A story as the admin sees it. With ->full() it also carries the body, sources and
 * what the signed-in person is allowed to do next.
 *
 * @mixin Article
 */
class ArticleResource extends JsonResource
{
    private bool $full = false;

    public function full(): static
    {
        $this->full = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->ulid,
            'title' => $this->getTranslation('title', 'en', false),
            'slug' => $this->slug,
            'excerpt' => $this->getTranslation('excerpt', 'en', false) ?: null,
            'status' => $this->status,
            'is_live' => $this->isLive(),
            'truth_label' => $this->truth_label,
            'is_breaking' => $this->is_breaking,
            'is_featured' => $this->is_featured,
            'reading_minutes' => $this->reading_minutes,
            'view_count' => $this->view_count,
            'review_note' => $this->review_note,
            'archived_reason' => $this->archived_reason,
            'author' => $this->whenLoaded('author', fn () => ['id' => $this->author->ulid, 'name' => $this->author->name]),
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'slug' => $this->category->slug, 'name' => $this->category->getTranslation('name', 'en'), 'color' => $this->category->color,
            ] : null),
            'area' => $this->whenLoaded('area', fn () => $this->area ? ['slug' => $this->area->slug, 'name' => $this->area->getTranslation('name', 'en')] : null),
            'cover' => $this->whenLoaded('cover', fn () => $this->cover?->toPublic()),
            'verified_by' => $this->whenLoaded('verifier', fn () => $this->verifier?->name),
            'published_by' => $this->whenLoaded('publisher', fn () => $this->publisher?->name),
            'verified_at' => $this->verified_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'corrected_at' => $this->corrected_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($this->full) {
            $data += [
                'body' => $this->getTranslation('body', 'en', false) ?: null,
                'tags' => $this->tags->pluck('name')->all(),
                'sources' => $this->sources->map(fn ($s) => [
                    'kind' => $s->kind, 'kind_label' => ArticleSource::KINDS[$s->kind] ?? $s->kind, 'label' => $s->label, 'url' => $s->url,
                ])->all(),
                'actions' => app(ArticleService::class)->allowedActions($request->user(), $this->resource),
            ];
        }

        return $data;
    }
}
