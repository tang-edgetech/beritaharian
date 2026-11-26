<?php

namespace App\Services\Directory;

use App\Exceptions\FriendlyException;
use App\Models\Area;
use App\Models\Directory\Business;
use App\Models\Directory\BusinessLocation;
use App\Models\Directory\Review;
use App\Models\Directory\Sector;
use App\Models\Media;
use App\Models\User;
use App\Services\MediaService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Creating and changing listings, from the admin, from owners and from public suggestions. */
class BusinessService
{
    public function __construct(private MediaService $media) {}

    /**
     * Full save from the admin. $data: sector, name, slug?, description?, ssm_number?, details?, contacts?, status?, locations[]
     * Each location: id? (ulid), label?, address, postcode?, area? (slug), latitude, longitude, phone?, hours_note?, is_primary?, hours[]
     */
    public function save(?Business $business, array $data, User $actor): Business
    {
        return DB::transaction(function () use ($business, $data, $actor) {
            $sector = Sector::where('slug', $data['sector'])->firstOrFail();
            $business ??= new Business(['created_by' => $actor->id, 'status' => $data['status'] ?? Business::ACTIVE]);

            $business->sector_id = $sector->id;
            $business->setTranslation('name', 'en', $data['name']);
            $business->setTranslation('description', 'en', $data['description'] ?? '');
            $business->slug = $this->uniqueSlug($data['slug'] ?? null ?: $data['name'], $business);
            $business->ssm_number = $data['ssm_number'] ?? null;
            $business->details = DetailSchema::cleanValues($sector, $data['details'] ?? []);
            $business->contacts = $this->cleanContacts($data['contacts'] ?? []);
            if (! $business->exists && ($business->status === Business::ACTIVE)) {
                $business->approved_by = $actor->id;
                $business->approved_at = now();
            }
            $business->save();

            $this->syncLocations($business, $data['locations'] ?? []);
            $this->refreshSearchText($business);

            return $business;
        });
    }

    /** A reader suggests a place (or adds their own). It waits for a moderator. */
    public function suggest(array $data, User $user): Business
    {
        return DB::transaction(function () use ($data, $user) {
            $sector = Sector::where('slug', $data['sector'])->where('is_active', true)->firstOrFail();
            $business = new Business([
                'sector_id' => $sector->id,
                'status' => Business::PENDING,
                'created_by' => $user->id,
                'submitted_note' => $data['note'] ?? null,
                'contacts' => $this->cleanContacts(['phone' => $data['phone'] ?? null, 'website' => $data['website'] ?? null]),
                'details' => [],
            ]);
            $business->setTranslation('name', 'en', $data['name']);
            $business->setTranslation('description', 'en', $data['description'] ?? '');
            $business->slug = $this->uniqueSlug($data['name'], $business);
            $business->save();

            $this->syncLocations($business, [[
                'address' => $data['address'],
                'area' => $data['area'] ?? null,
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'is_primary' => true,
                'hours' => [],
            ]]);
            $this->refreshSearchText($business);

            if (! empty($data['is_owner'])) {
                $business->members()->attach($user->id, ['role' => 'owner']);
                $business->forceFill(['is_claimed' => true])->save();
            }

            return $business;
        });
    }

    /**
     * What an owner may change themselves: description, contacts, details, and per branch the phone,
     * hours note and opening hours. Name, sector and address go through us, so listings can't be hijacked.
     */
    public function ownerUpdate(Business $business, array $data, User $owner): Business
    {
        if (! $business->isManagedBy($owner)) {
            throw new FriendlyException('Only the people who manage this place can change it.', 'NOT_MANAGER', 403);
        }

        return DB::transaction(function () use ($business, $data) {
            $business->setTranslation('description', 'en', $data['description'] ?? '');
            $business->details = DetailSchema::cleanValues($business->sector, $data['details'] ?? []);
            $business->contacts = $this->cleanContacts($data['contacts'] ?? []);
            $business->save();

            foreach ($data['locations'] ?? [] as $i => $row) {
                $location = $business->locations()->where('ulid', $row['id'] ?? '')->first();
                if (! $location) {
                    continue;
                }
                $location->update(['phone' => $row['phone'] ?? null, 'hours_note' => $row['hours_note'] ?? null]);
                $this->syncHours($location, OpeningHours::normalize($row['hours'] ?? [], "locations.{$i}.hours"));
            }
            $this->refreshSearchText($business);

            return $business;
        });
    }

    public function approve(Business $business, User $actor): void
    {
        $business->forceFill(['status' => Business::ACTIVE, 'approved_by' => $actor->id, 'approved_at' => now(), 'moderation_note' => null])->save();
        $business->members->each(fn (User $u) => $u->hasRole('business-owner') || $u->assignRole('business-owner'));
    }

    public function suspend(Business $business, string $note): void
    {
        $business->forceFill(['status' => Business::SUSPENDED, 'moderation_note' => $note])->save();
    }

    public function reinstate(Business $business): void
    {
        $business->forceFill(['status' => Business::ACTIVE, 'moderation_note' => null])->save();
    }

    public function addPhoto(Business $business, UploadedFile $file, string $collection, User $actor, ?string $alt = null): Media
    {
        if ($collection === 'logo') {
            $business->logo?->delete();
        } elseif ($business->photos()->count() >= 20) {
            throw new FriendlyException('A place can have up to 20 photos. Remove one to add another.', 'TOO_MANY_PHOTOS');
        }
        $media = $this->media->storeImage($file, $collection, $actor, ['alt' => $alt ?: $business->displayName()]);
        $media->forceFill([
            'mediable_type' => $business->getMorphClass(),
            'mediable_id' => $business->id,
            'position' => (int) $business->photos()->max('position') + 1,
        ])->save();
        $business->touch();

        return $media;
    }

    public function removePhoto(Business $business, string $mediaId): void
    {
        $media = Media::where('mediable_type', $business->getMorphClass())->where('mediable_id', $business->id)->where('ulid', $mediaId)->firstOrFail();
        $media->delete();
        $business->touch();
    }

    /** @param  string[]  $ids */
    public function reorderPhotos(Business $business, array $ids): void
    {
        foreach (array_values($ids) as $position => $id) {
            $business->photos()->where('ulid', $id)->update(['position' => $position]);
        }
        $business->touch();
    }

    /** Recounts the stars from visible reviews. */
    public function refreshRating(Business $business): void
    {
        $stats = Review::where('business_id', $business->id)->visible()->selectRaw('COUNT(*) as n, AVG(rating) as avg')->first();
        $business->forceFill([
            'rating_count' => (int) $stats->n,
            'rating_avg' => $stats->n ? round((float) $stats->avg, 2) : 0,
        ])->saveQuietly();
        // saveQuietly skips the cache event, so refresh by hand
        app(\App\Services\SiteCache::class)->refresh(['places', "place-{$business->slug}"]);
    }

    private function syncLocations(Business $business, array $rows): void
    {
        if (! $rows) {
            throw new FriendlyException('A place needs at least one address on the map.', 'NO_LOCATION');
        }
        $areas = Area::whereIn('slug', collect($rows)->pluck('area')->filter())->pluck('id', 'slug');
        $keep = [];
        $rows = array_values($rows);
        $primaryIndex = collect($rows)->search(fn ($r) => ! empty($r['is_primary'])) ?: 0;

        foreach ($rows as $i => $row) {
            $location = isset($row['id']) ? $business->locations()->where('ulid', $row['id'])->first() : null;
            $location ??= new BusinessLocation(['business_id' => $business->id]);
            $location->fill([
                'label' => $row['label'] ?? null,
                'address' => $row['address'],
                'postcode' => $row['postcode'] ?? null,
                'area_id' => isset($row['area']) ? ($areas[$row['area']] ?? null) : null,
                'latitude' => $row['latitude'],
                'longitude' => $row['longitude'],
                'phone' => $row['phone'] ?? null,
                'hours_note' => $row['hours_note'] ?? null,
                'is_primary' => $i === $primaryIndex,
                'position' => $i,
            ])->save();
            $this->syncHours($location, OpeningHours::normalize($row['hours'] ?? [], "locations.{$i}.hours"));
            $keep[] = $location->id;
        }

        $business->locations()->whereNotIn('id', $keep)->get()->each->delete();
    }

    private function syncHours(BusinessLocation $location, array $hours): void
    {
        $location->hours()->delete();
        foreach ($hours as $row) {
            $location->hours()->create($row);
        }
    }

    private function cleanContacts(array $contacts): array
    {
        return collect(Business::CONTACT_KEYS)
            ->mapWithKeys(fn ($key) => [$key => isset($contacts[$key]) ? trim((string) $contacts[$key]) : null])
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->all();
    }

    private function uniqueSlug(string $source, Business $business): string
    {
        $base = Str::slug(Str::limit($source, 90, '')) ?: 'place';
        $slug = $base;
        $n = 2;
        while (Business::withTrashed()->where('slug', $slug)->whereKeyNot($business->id)->exists()) {
            $slug = "{$base}-{$n}";
            $n++;
        }

        return $slug;
    }

    public function refreshSearchText(Business $business): void
    {
        $business->load(['sector', 'locations.area']);
        $text = collect([
            $business->displayName(),
            $business->sector?->getTranslation('name', 'en'),
            strip_tags((string) $business->getTranslation('description', 'en', false)),
            ...$business->locations->flatMap(fn (BusinessLocation $l) => [$l->label, $l->address, $l->area?->getTranslation('name', 'en')]),
            ...collect($business->details ?? [])->flatten()->filter(fn ($v) => is_string($v)),
        ])->filter()->implode(' ');
        $business->forceFill(['search_text' => Str::limit($text, 4000, '')])->saveQuietly();
    }
}
