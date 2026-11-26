<?php

namespace App\Services\Directory;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Opening hours for a branch, stored as rows of {day 0-6 (Sunday first), opens "HH:MM", closes "HH:MM"}.
 * A period whose closing time is not after its opening time runs past midnight (e.g. 18:00–02:00).
 * "Open 24 hours" is 00:00–24:00.
 */
class OpeningHours
{
    public const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    /** Checks and tidies hours sent by a form. @return array<int, array{day: int, opens: string, closes: string}> */
    public static function normalize(?array $rows, string $field = 'hours'): array
    {
        $clean = [];
        foreach ($rows ?? [] as $i => $row) {
            $day = $row['day'] ?? null;
            $opens = $row['opens'] ?? null;
            $closes = $row['closes'] ?? null;
            $valid = is_numeric($day) && (int) $day >= 0 && (int) $day <= 6
                && is_string($opens) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $opens)
                && is_string($closes) && preg_match('/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/', $closes)
                && $opens !== $closes;
            if (! $valid) {
                throw ValidationException::withMessages(["{$field}.{$i}" => 'Please check the opening and closing times.']);
            }
            $clean[] = ['day' => (int) $day, 'opens' => $opens, 'closes' => $closes];
        }

        return collect($clean)->unique(fn ($r) => "{$r['day']}-{$r['opens']}")->sortBy(fn ($r) => sprintf('%d-%s', $r['day'], $r['opens']))->values()->all();
    }

    /** Limits a business_hours query to periods open at the given moment. */
    public static function constrainOpenAt(Builder $hours, Carbon $at): Builder
    {
        $day = $at->dayOfWeek;
        $previous = ($day + 6) % 7;
        $time = $at->format('H:i');

        return $hours->where(fn (Builder $w) => $w
            ->where(fn (Builder $x) => $x->where('day', $day)->where('opens', '<=', $time)
                ->where(fn (Builder $y) => $y->where('closes', '>', $time)->orWhereColumn('closes', '<=', 'opens')))
            ->orWhere(fn (Builder $x) => $x->where('day', $previous)->whereColumn('closes', '<=', 'opens')->where('closes', '>', $time)));
    }

    /** @param  Collection<int, object{day: int, opens: string, closes: string}>|array  $hours */
    public static function isOpen($hours, Carbon $at): bool
    {
        $day = $at->dayOfWeek;
        $previous = ($day + 6) % 7;
        $time = $at->format('H:i');

        foreach ($hours as $h) {
            $overnight = $h['closes'] <= $h['opens'];
            if ($h['day'] === $day && $h['opens'] <= $time && ($overnight || $h['closes'] > $time)) {
                return true;
            }
            if ($h['day'] === $previous && $overnight && $h['closes'] > $time) {
                return true;
            }
        }

        return false;
    }

    /**
     * Short line for cards: "Open until 10:00 pm", "Closed · opens 8:00 am Tue", "Open 24 hours".
     * Returns null open/label when no hours were entered.
     *
     * @return array{open: bool|null, label: string|null}
     */
    public static function status($hours, Carbon $at): array
    {
        $hours = collect($hours)->map(fn ($h) => ['day' => (int) $h['day'], 'opens' => $h['opens'], 'closes' => $h['closes']])->values();
        if ($hours->isEmpty()) {
            return ['open' => null, 'label' => null];
        }

        if (self::isOpen($hours, $at)) {
            $today = $at->dayOfWeek;
            $time = $at->format('H:i');
            $current = $hours->first(fn ($h) => $h['day'] === $today && $h['opens'] <= $time && ($h['closes'] <= $h['opens'] || $h['closes'] > $time))
                ?? $hours->first(fn ($h) => $h['day'] === ($today + 6) % 7 && $h['closes'] <= $h['opens']);
            if ($current['opens'] === '00:00' && $current['closes'] === '24:00') {
                return ['open' => true, 'label' => 'Open 24 hours'];
            }

            return ['open' => true, 'label' => 'Open until '.self::clock($current['closes'])];
        }

        // next opening in the coming week
        for ($offset = 0; $offset < 8; $offset++) {
            $date = $at->copy()->addDays($offset);
            $periods = $hours->where('day', $date->dayOfWeek)->sortBy('opens');
            foreach ($periods as $p) {
                if ($offset === 0 && $p['opens'] <= $at->format('H:i')) {
                    continue;
                }
                $when = $offset === 0 ? '' : ($offset === 1 ? ' tomorrow' : ' '.substr(self::DAYS[$date->dayOfWeek], 0, 3));

                return ['open' => false, 'label' => 'Closed · opens '.self::clock($p['opens']).$when];
            }
        }

        return ['open' => false, 'label' => 'Closed'];
    }

    /** The whole week for a branch page: [{day, name, periods: [{opens, closes, label}]}], Monday first. */
    public static function week($hours): array
    {
        $hours = collect($hours)->map(fn ($h) => ['day' => (int) $h['day'], 'opens' => $h['opens'], 'closes' => $h['closes']]);

        return collect([1, 2, 3, 4, 5, 6, 0])->map(fn (int $day) => [
            'day' => $day,
            'name' => self::DAYS[$day],
            'periods' => $hours->where('day', $day)->sortBy('opens')->values()->map(fn ($p) => [
                'opens' => $p['opens'],
                'closes' => $p['closes'],
                'label' => $p['opens'] === '00:00' && $p['closes'] === '24:00' ? 'Open 24 hours' : self::clock($p['opens']).' – '.self::clock($p['closes']),
            ])->all(),
        ])->all();
    }

    public static function clock(string $time): string
    {
        if ($time === '24:00') {
            return 'midnight';
        }

        return Carbon::createFromFormat('H:i', $time)->format('g:i a');
    }

    /** Great-circle distance in metres. */
    public static function distance(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return (int) round($r * 2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
