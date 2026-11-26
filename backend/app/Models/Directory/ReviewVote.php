<?php

namespace App\Models\Directory;

use Illuminate\Database\Eloquent\Model;

/** "This review was helpful", one per person per review. */
class ReviewVote extends Model
{
    protected $fillable = ['review_id', 'user_id'];
}
