<?php

namespace App\Services\Directory;

use App\Exceptions\FriendlyException;
use App\Models\Directory\Business;
use App\Models\Directory\BusinessClaim;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/** "Claim this business": the owner proves it with an SSM number or a document, a moderator decides. */
class ClaimService
{
    public function submit(Business $business, User $user, array $data, ?UploadedFile $document): BusinessClaim
    {
        if ($business->status !== Business::ACTIVE) {
            throw new FriendlyException('This place is not open for claims right now.', 'NOT_CLAIMABLE');
        }
        if ($business->isManagedBy($user)) {
            throw new FriendlyException('You already manage this place.', 'ALREADY_MANAGER');
        }
        if ($business->claims()->where('user_id', $user->id)->where('status', BusinessClaim::PENDING)->exists()) {
            throw new FriendlyException('Your earlier claim is still being checked. We will email you when it is done.', 'CLAIM_PENDING');
        }

        $claim = new BusinessClaim([
            'business_id' => $business->id,
            'user_id' => $user->id,
            'role' => $data['role'] ?? 'owner',
            'ssm_number' => $data['ssm_number'] ?? null,
            'phone' => $data['phone'],
            'note' => $data['note'] ?? null,
            'status' => BusinessClaim::PENDING,
        ]);
        $claim->save();

        if ($document) {
            $path = $document->storeAs('directory/claims', "{$claim->ulid}.{$document->extension()}", 'local');
            $claim->forceFill(['document_path' => $path])->saveQuietly();
        }

        return $claim;
    }

    public function approve(BusinessClaim $claim, User $actor, ?string $note = null): void
    {
        $this->ensurePending($claim);
        DB::transaction(function () use ($claim, $actor, $note) {
            $business = $claim->business;
            $business->members()->syncWithoutDetaching([$claim->user_id => ['role' => $claim->role]]);
            $business->forceFill(['is_claimed' => true])->save();
            if ($claim->ssm_number && ! $business->ssm_number) {
                $business->forceFill(['ssm_number' => $claim->ssm_number])->save();
            }
            $claim->user->hasRole('business-owner') || $claim->user->assignRole('business-owner');
            $claim->forceFill(['status' => BusinessClaim::APPROVED, 'decided_by' => $actor->id, 'decided_at' => now(), 'decision_note' => $note])->save();
        });
    }

    public function reject(BusinessClaim $claim, User $actor, string $note): void
    {
        $this->ensurePending($claim);
        $claim->forceFill(['status' => BusinessClaim::REJECTED, 'decided_by' => $actor->id, 'decided_at' => now(), 'decision_note' => $note])->save();
        // the document was only needed for the check
        $this->deleteDocument($claim);
    }

    public function deleteDocument(BusinessClaim $claim): void
    {
        if ($claim->document_path) {
            Storage::disk('local')->delete($claim->document_path);
            $claim->forceFill(['document_path' => null])->saveQuietly();
        }
    }

    private function ensurePending(BusinessClaim $claim): void
    {
        if ($claim->status !== BusinessClaim::PENDING) {
            throw new FriendlyException('This claim has already been decided.', 'CLAIM_DECIDED');
        }
    }
}
