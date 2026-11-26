<?php

namespace App\Models\Directory;

use Illuminate\Database\Eloquent\Model;

/** One opening period of a branch, e.g. Monday 08:00–15:00. */
class BusinessHour extends Model
{
    public $timestamps = false;

    protected $fillable = ['business_location_id', 'day', 'opens', 'closes'];

    protected function casts(): array
    {
        return ['day' => 'integer'];
    }
}
