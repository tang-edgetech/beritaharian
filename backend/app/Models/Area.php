<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

/** A place in Melaka: a district (Melaka Tengah, Alor Gajah, Jasin) or a locality inside one (Bandar Hilir, Klebang). */
class Area extends Model
{
    use HasTranslations;

    public const DISTRICT = 'district';

    public const LOCALITY = 'locality';

    public array $translatable = ['name'];

    protected $fillable = ['parent_id', 'type', 'name', 'slug', 'latitude', 'longitude', 'position'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float'];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('position');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** This area and every locality inside it, for "news in Melaka Tengah" style filters. */
    public function selfAndChildIds(): array
    {
        return [$this->id, ...$this->children()->pluck('id')->all()];
    }
}
