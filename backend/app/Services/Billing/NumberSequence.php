<?php

namespace App\Services\Billing;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Running numbers for formal documents: CS-INV-2026-000001, CS-INV-2026-000002 …
 * The row is locked while a number is taken, so two staff issuing at the same moment
 * never get the same number and no number is skipped. Must run inside a transaction.
 */
class NumberSequence
{
    public function next(string $type, string $prefix, CarbonInterface $date): string
    {
        $year = (int) $date->format('Y');

        DB::table('number_sequences')->insertOrIgnore([
            'type' => $type, 'year' => $year, 'next_value' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $row = DB::table('number_sequences')->where(['type' => $type, 'year' => $year])->lockForUpdate()->first();
        DB::table('number_sequences')->where('id', $row->id)->update(['next_value' => $row->next_value + 1, 'updated_at' => now()]);

        return sprintf('%s-%d-%06d', $prefix, $year, $row->next_value);
    }
}
