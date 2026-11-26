<?php

namespace App\Services\Directory;

use App\Models\Directory\Sector;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The extra details a sector asks for (halal, cuisine, star rating...). The sector stores a list of
 * fields; a business stores the answers in businesses.details. This class checks both.
 */
class DetailSchema
{
    /** Checks the field list a moderator builds for a sector. */
    public static function cleanFields(?array $fields): array
    {
        $clean = [];
        $keys = [];
        foreach ($fields ?? [] as $i => $field) {
            $label = trim((string) ($field['label'] ?? ''));
            $key = Str::slug((string) (($field['key'] ?? '') ?: $label), '_');
            $type = $field['type'] ?? null;
            if ($label === '' || $key === '') {
                throw ValidationException::withMessages(["fields.{$i}.label" => 'Every detail needs a name.']);
            }
            if (in_array($key, $keys, true)) {
                throw ValidationException::withMessages(["fields.{$i}.label" => "Two details are called “{$label}”. Please give each a different name."]);
            }
            if (! in_array($type, Sector::FIELD_TYPES, true)) {
                throw ValidationException::withMessages(["fields.{$i}.type" => 'Please choose what kind of answer this detail takes.']);
            }
            $options = collect($field['options'] ?? [])->map(fn ($o) => trim((string) $o))->filter()->unique()->values()->all();
            if (in_array($type, ['select', 'multiselect'], true) && count($options) < 2) {
                throw ValidationException::withMessages(["fields.{$i}.options" => "Give “{$label}” at least two choices."]);
            }
            $keys[] = $key;
            $clean[] = array_filter([
                'key' => $key,
                'label' => Str::limit($label, 60, ''),
                'type' => $type,
                'options' => in_array($type, ['select', 'multiselect'], true) ? $options : null,
                'unit' => isset($field['unit']) && trim((string) $field['unit']) !== '' && $type === 'number' ? Str::limit(trim($field['unit']), 20, '') : null,
                'filterable' => (bool) ($field['filterable'] ?? false) && in_array($type, ['boolean', 'select', 'multiselect'], true),
            ], fn ($v) => $v !== null);
        }

        return $clean;
    }

    /** Checks a business's answers against its sector. Unknown keys are dropped, blanks left out. */
    public static function cleanValues(Sector $sector, ?array $values, string $prefix = 'details'): array
    {
        $clean = [];
        foreach ($sector->fields() as $field) {
            $key = $field['key'];
            $value = $values[$key] ?? null;
            if ($value === null || $value === '' || $value === []) {
                continue;
            }
            $error = fn () => throw ValidationException::withMessages(["{$prefix}.{$key}" => "Please check “{$field['label']}”."]);
            $clean[$key] = match ($field['type']) {
                'boolean' => is_bool($value) || in_array($value, [0, 1, '0', '1', 'true', 'false'], true) ? filter_var($value, FILTER_VALIDATE_BOOLEAN) : $error(),
                'number' => is_numeric($value) ? $value + 0 : $error(),
                'text' => is_string($value) && mb_strlen($value) <= 200 ? trim($value) : $error(),
                'select' => in_array($value, $field['options'] ?? [], true) ? $value : $error(),
                'multiselect' => is_array($value) && ! array_diff($value, $field['options'] ?? []) ? array_values(array_unique($value)) : $error(),
            };
        }

        return $clean;
    }

    /** Answers with their labels, ready to show: [{key, label, type, value, display}]. */
    public static function present(Sector $sector, ?array $values): array
    {
        $out = [];
        foreach ($sector->fields() as $field) {
            if (! array_key_exists($field['key'], $values ?? [])) {
                continue;
            }
            $value = $values[$field['key']];
            $display = match ($field['type']) {
                'boolean' => $value ? 'Yes' : 'No',
                'multiselect' => implode(', ', (array) $value),
                'number' => trim($value.' '.($field['unit'] ?? '')),
                default => (string) $value,
            };
            $out[] = ['key' => $field['key'], 'label' => $field['label'], 'type' => $field['type'], 'value' => $value, 'display' => $display];
        }

        return $out;
    }

    /** Applies ?details[halal]=1&details[cuisine]=Nyonya style filters for the sector's filterable fields. */
    public static function filter(Builder $businesses, Sector $sector, array $filters): Builder
    {
        foreach ($sector->fields() as $field) {
            $value = $filters[$field['key']] ?? null;
            if (empty($field['filterable']) || $value === null || $value === '') {
                continue;
            }
            $path = 'details->'.$field['key'];
            match ($field['type']) {
                'boolean' => $businesses->where($path, filter_var($value, FILTER_VALIDATE_BOOLEAN)),
                'select' => $businesses->where($path, (string) $value),
                'multiselect' => $businesses->whereJsonContains($path, (string) $value),
                default => null,
            };
        }

        return $businesses;
    }
}
