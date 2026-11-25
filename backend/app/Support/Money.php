<?php

namespace App\Support;

/** Ringgit amounts are kept as whole sen. These helpers convert and print them. */
final class Money
{
    /** "RM 1,234.50" */
    public static function format(int $sen, bool $withSymbol = true): string
    {
        $negative = $sen < 0;
        $value = number_format(abs($sen) / 100, 2, '.', ',');

        return ($negative ? '-' : '').($withSymbol ? 'RM '.$value : $value);
    }

    /** 12.5 or "12.50" -> 1250 */
    public static function toSen(float|int|string|null $ringgit): int
    {
        return (int) round(((float) $ringgit) * 100);
    }

    /** "Ringgit Malaysia One Thousand Two Hundred Fifty and Sen Fifty Only", as printed on Malaysian receipts. */
    public static function words(int $sen): string
    {
        $sen = abs($sen);
        $ringgit = intdiv($sen, 100);
        $cents = $sen % 100;
        $text = 'Ringgit Malaysia '.($ringgit ? self::spell($ringgit) : 'Zero');
        if ($cents) {
            $text .= ' and Sen '.self::spell($cents);
        }

        return $text.' Only';
    }

    private static function spell(int $n): string
    {
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
            'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        if ($n < 20) {
            return $ones[$n];
        }
        if ($n < 100) {
            return trim($tens[intdiv($n, 10)].' '.$ones[$n % 10]);
        }
        if ($n < 1000) {
            return trim($ones[intdiv($n, 100)].' Hundred '.self::spell($n % 100));
        }
        foreach ([1_000_000_000 => 'Billion', 1_000_000 => 'Million', 1000 => 'Thousand'] as $size => $word) {
            if ($n >= $size) {
                return trim(self::spell(intdiv($n, $size)).' '.$word.' '.self::spell($n % $size));
            }
        }

        return '';
    }

    /** Tax on an amount at a percentage rate, rounded to the nearest sen. */
    public static function tax(int $amountSen, float $ratePercent): int
    {
        return (int) round($amountSen * $ratePercent / 100);
    }
}
