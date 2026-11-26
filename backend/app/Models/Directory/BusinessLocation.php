<?php

namespace App\Models\Directory;

use App\Models\Area;
use App\Services\Directory\OpeningHours;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A branch of a business: an address and a pin on the map, with its own opening hours. */
class BusinessLocation extends Model
{
    use HasUlids;

    protected $fillable = ['business_id', 'area_id', 'label', 'address', 'postcode', 'latitude', 'longitude', 'phone', 'hours_note', 'is_primary', 'position'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'is_primary' => 'boolean'];
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function hours(): HasMany
    {
        return $this->hasMany(BusinessHour::class)->orderBy('day')->orderBy('opens');
    }

    /** Distance in metres to a point. */
    public function distanceTo(float $lat, float $lng): int
    {
        return OpeningHours::distance($this->latitude, $this->longitude, $lat, $lng);
    }
}
