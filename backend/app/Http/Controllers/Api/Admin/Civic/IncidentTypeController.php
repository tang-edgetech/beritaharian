<?php

namespace App\Http\Controllers\Api\Admin\Civic;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Civic\IncidentPresent;
use App\Models\Civic\Incident;
use App\Models\Civic\IncidentType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** The kinds of incident readers can choose from when reporting. Drag and drop sets the order. */
class IncidentTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => IncidentType::withCount('incidents')->ordered()->get()->map(fn ($t) => IncidentPresent::type($t, true))]);
    }

    public function show(IncidentType $type): JsonResponse
    {
        return response()->json(['data' => IncidentPresent::type($type->loadCount('incidents'), true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $type = IncidentType::create([
            ...$this->fields($data),
            'slug' => $this->uniqueSlug($data['slug'] ?? $data['name']),
            'position' => (int) IncidentType::max('position') + 1,
        ]);

        return response()->json(['message' => 'Incident type added.', 'data' => IncidentPresent::type($type->loadCount('incidents'), true)], 201);
    }

    public function update(Request $request, IncidentType $type): JsonResponse
    {
        $data = $this->validated($request, $type);
        $type->update([...$this->fields($data), 'slug' => isset($data['slug']) && $data['slug'] !== $type->slug ? $this->uniqueSlug($data['slug']) : $type->slug]);

        return response()->json(['message' => 'Incident type saved.', 'data' => IncidentPresent::type($type->loadCount('incidents'), true)]);
    }

    public function destroy(IncidentType $type): JsonResponse
    {
        if (Incident::withTrashed()->where('incident_type_id', $type->id)->exists()) {
            throw new FriendlyException('Reports use this type, so it can’t be deleted. Turn it off instead to hide it from the report form.', 'TYPE_IN_USE');
        }
        $type->delete();

        return response()->json(['message' => 'Incident type deleted.']);
    }

    /** PUT /admin/incident-types/order { slugs: string[] } */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['slugs' => ['required', 'array'], 'slugs.*' => ['string']]);
        foreach ($data['slugs'] as $position => $slug) {
            IncidentType::where('slug', $slug)->update(['position' => $position]);
        }

        return response()->json(['message' => 'Order saved.']);
    }

    private function validated(Request $request, ?IncidentType $type = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
            'slug' => ['nullable', 'string', 'max:80', 'alpha_dash', Rule::unique('incident_types', 'slug')->ignore($type?->id)],
            'icon' => ['required', 'string', 'max:40'],
            'color' => ['required', Rule::in(IncidentType::COLORS)],
            'default_severity' => ['required', Rule::in(Incident::SEVERITIES)],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function fields(array $data): array
    {
        return [
            'name' => ['en' => $data['name']],
            'description' => ['en' => $data['description'] ?? ''],
            'icon' => $data['icon'],
            'color' => $data['color'],
            'default_severity' => $data['default_severity'],
            'is_active' => (bool) ($data['is_active'] ?? true),
        ];
    }

    private function uniqueSlug(string $value): string
    {
        $base = Str::slug($value) ?: 'type';
        $slug = $base;
        $i = 2;
        while (IncidentType::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
