<?php

namespace App\Http\Controllers\Api\Admin\Directory;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\Directory\Present;
use App\Models\Directory\BusinessClaim;
use App\Services\Directory\ClaimService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClaimController extends Controller
{
    public function __construct(private ClaimService $claims) {}

    /** GET /admin/directory/claims?filter[status]=pending&filter[q]= */
    public function index(Request $request): JsonResponse
    {
        $page = QueryBuilder::for(BusinessClaim::query()->with(['business.sector', 'user', 'decider']))
            ->allowedFilters(
                AllowedFilter::callback('status', fn (Builder $q, $value) => $q->whereIn('status', (array) $value)),
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->whereHas('business', fn (Builder $b) => $b->where('search_text', 'like', "%{$value}%"))
                    ->orWhereHas('user', fn (Builder $u) => $u->where('name', 'like', "%{$value}%")->orWhere('email', 'like', "%{$value}%"))
                    ->orWhere('ssm_number', 'like', "%{$value}%"))),
            )
            ->allowedSorts('created_at', 'decided_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (BusinessClaim $c) => Present::claim($c)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    public function show(BusinessClaim $claim): JsonResponse
    {
        $claim->load(['business.sector', 'user', 'decider']);
        $others = BusinessClaim::where('business_id', $claim->business_id)->whereKeyNot($claim->id)->with(['user', 'decider', 'business.sector'])->latest()->get();

        return response()->json(['data' => Present::claim($claim) + [
            'other_claims' => $others->map(fn (BusinessClaim $c) => Present::claim($c))->all(),
            'managers' => $claim->business->members->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->pivot->role])->all(),
        ]]);
    }

    /** POST /admin/directory/claims/{claim}/decide { action: approve|reject, note? } */
    public function decide(Request $request, BusinessClaim $claim): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'note' => ['required_if:action,reject', 'nullable', 'string', 'max:1000'],
        ], ['note.required_if' => 'Please write why, so the person knows what to send next time.']);

        if ($data['action'] === 'approve') {
            $this->claims->approve($claim, $request->user(), $data['note'] ?? null);
            $message = "Approved. {$claim->user->name} now manages {$claim->business->displayName()}.";
        } else {
            $this->claims->reject($claim, $request->user(), $data['note']);
            $message = 'Claim turned down.';
        }

        return response()->json(['message' => $message]);
    }

    public function document(BusinessClaim $claim): StreamedResponse
    {
        if (! $claim->document_path || ! Storage::disk('local')->exists($claim->document_path)) {
            throw new FriendlyException('There is no document for this claim.', 'NO_FILE', 404);
        }

        return Storage::disk('local')->download($claim->document_path, "claim-{$claim->ulid}.".pathinfo($claim->document_path, PATHINFO_EXTENSION));
    }
}
