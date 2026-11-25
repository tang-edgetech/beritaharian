<?php

namespace App\Http\Resources\News;

use App\Models\News\Article;
use App\Models\News\ArticleSource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A story as readers see it. Cards (lists) leave out the body; ->full() adds the body,
 * sources and public corrections. Staff-only details (notes, drafts, who verified) never appear.
 *
 * @mixin Article
 */
class PublicArticleResource extends JsonResource
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
            'slug' => $this->slug,
            'title' => $this->getTranslation('title', 'en'),
            'excerpt' => $this->getTranslation('excerpt', 'en', false) ?: null,
            'truth_label' => $this->truth_label,
            'is_breaking' => $this->is_breaking,
            'reading_minutes' => $this->reading_minutes,
            'published_at' => $this->published_at?->toIso8601String(),
            'corrected_at' => $this->corrected_at?->toIso8601String(),
            'author' => ['name' => $this->author?->name ?? 'Cendol Satay'],
            'category' => $this->category ? [
                'slug' => $this->category->slug, 'name' => $this->category->getTranslation('name', 'en'), 'color' => $this->category->color,
            ] : null,
            'area' => $this->area ? ['slug' => $this->area->slug, 'name' => $this->area->getTranslation('name', 'en')] : null,
            'cover' => $this->cover?->toPublic(),
        ];

        if ($this->full) {
            $data += [
                'body' => $this->getTranslation('body', 'en', false) ?: null,
                'tags' => $this->tags->map(fn ($t) => ['name' => $t->name, 'slug' => $t->slug])->all(),
                'sources' => $this->sources->map(fn ($s) => [
                    'kind' => ArticleSource::KINDS[$s->kind] ?? $s->kind, 'label' => $s->label, 'url' => $s->url,
                ])->all(),
                'corrections' => $this->corrections->map(fn ($c) => [
                    'note' => $c->change_note, 'at' => $c->created_at?->toIso8601String(),
                ])->all(),
                'updated_at' => $this->updated_at?->toIso8601String(),
            ];
        }

        return $data;
    }
}
