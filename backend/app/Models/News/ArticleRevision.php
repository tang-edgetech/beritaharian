<?php

namespace App\Models\News;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A saved copy of the story's words after each edit. Public corrections are shown under the published story. */
class ArticleRevision extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['editor_id', 'snapshot', 'change_note', 'is_public_correction'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'is_public_correction' => 'boolean', 'created_at' => 'datetime'];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }
}
