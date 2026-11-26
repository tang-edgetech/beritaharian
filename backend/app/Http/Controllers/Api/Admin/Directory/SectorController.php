<?php

namespace App\Http\Controllers\Api\Admin\Directory;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Directory\Present;
use App\Models\Directory\Sector;
use App\Services\Directory\DetailSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SectorController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Sector::ordered()->withCount('businesses')->get()->map(fn (Sector $s) => Present::sector($s))]);
    }

    public function show(Sector $sector): JsonResponse
    {
        return response()->json(['data' => Present::sector($sector->loadCount('businesses'))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $sector = new Sector(['position' => (int) Sector::max('position') + 1]);
        $this->fill($sector, $data)->save();

        return response()->json(['message' => "Sector “{$data['name']}” added.", 'data' => Present::sector($sector->loadCount('businesses'))], 201);
    }

    public function update(Request $request, Sector $sector): JsonResponse
    {
        $this->fill($sector, $this->validated($request, $sector))->save();

        return response()->json(['message' => 'Sector saved.', 'data' => Present::sector($sector->loadCount('businesses'))]);
    }

    public function destroy(Sector $sector): JsonResponse
    {
        if ($sector->businesses()->withTrashed()->exists()) {
            throw new FriendlyException('Places still use this sector. Move them first, or turn the sector off instead.', 'SECTOR_IN_USE');
        }
        $sector->delete();

        return response()->json(['message' => 'Sector deleted.']);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['slugs' => ['required', 'array'], 'slugs.*' => ['string']]);
        DB::transaction(function () use ($data) {
            foreach ($data['slugs'] as $position => $slug) {
                Sector::where('slug', $slug)->update(['position' => $position]);
            }
        });

        return response()->json(['message' => 'New order saved.']);
    }

    private function fill(Sector $sector, array $data): Sector
    {
        $sector->setTranslation('name', 'en', $data['name']);
        $sector->setTranslation('description', 'en', $data['description'] ?? '');
        $sector->slug = $data['slug'];
        $sector->icon = $data['icon'] ?? 'store';
        $sector->color = $data['color'];
        $sector->is_active = $data['is_active'] ?? true;
        $sector->attribute_schema = DetailSchema::cleanFields($data['fields'] ?? []);

        return $sector;
    }

    private function validated(Request $request, ?Sector $sector = null): array
    {
        $request->merge(['slug' => Str::slug($request->input('slug') ?: $request->input('name', ''))]);

        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'slug' => ['required', 'string', 'max:80', Rule::unique('sectors', 'slug')->ignore($sector?->id)],
            'description' => ['nullable', 'string', 'max:300'],
            'icon' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'color' => ['required', Rule::in(Sector::COLORS)],
            'is_active' => ['boolean'],
            'fields' => ['nullable', 'array', 'max:30'],
        ], [
            'name.required' => 'Please give the sector a name.',
            'slug.unique' => 'Another sector already uses this web address.',
        ]);
    }
}
