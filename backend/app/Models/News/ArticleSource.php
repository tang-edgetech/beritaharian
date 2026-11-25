<?php

namespace App\Models\News;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Where a fact came from, shown at the end of the story so readers can check it. */
class ArticleSource extends Model
{
    public const KINDS = [
        'official' => 'Official statement',
        'witness' => 'Witness',
        'document' => 'Document',
        'media' => 'Other media',
    ];

    protected $fillable = ['kind', 'label', 'url', 'position'];

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }
}
