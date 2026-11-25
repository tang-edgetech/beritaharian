<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use App\Services\SettingService;
use App\Services\TwoFactorService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class UserController extends Controller
{
    public function __construct(private AuthService $auth) {}

    /**
     * GET /admin/users?filter[q]=ali&filter[status]=active&filter[role]=editor&filter[verified]=yes
     *     &filter[trashed]=with|only&sort=-created_at&per_page=25&page=2
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $users = QueryBuilder::for(User::query()->with(['profile', 'roles']))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('name', 'like', "%{$value}%")
                    ->orWhere('email', 'like', "%{$value}%")
                    ->orWhere('phone', 'like', "%{$value}%"))),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('role', fn (Builder $q, $value) => $q->whereHas('roles', fn (Builder $r) => $r->whereIn('name', (array) $value))),
                AllowedFilter::callback('verified', fn (Builder $q, $value) => $value === 'yes' || $value === true
                    ? $q->where(fn (Builder $w) => $w->whereNotNull('email_verified_at')->orWhereNotNull('phone_verified_at'))
                    : $q->whereNull('email_verified_at')->whereNull('phone_verified_at')),
                AllowedFilter::callback('two_factor', fn (Builder $q, $value) => $value === 'yes' || $value === true
                    ? $q->whereNotNull('two_factor_confirmed_at')
                    : $q->whereNull('two_factor_confirmed_at')),
                AllowedFilter::callback('created_from', fn (Builder $q, $value) => $q->whereDate('created_at', '>=', $value)),
                AllowedFilter::callback('created_to', fn (Builder $q, $value) => $q->whereDate('created_at', '<=', $value)),
                AllowedFilter::trashed(),
            )
            ->allowedSorts('name', 'email', 'status', 'created_at', 'last_login_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return UserResource::collection($users);
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user->load(['profile', 'roles']));
    }

    public function store(Request $request, SettingService $settings): JsonResponse
    {
        $data = $this->validated($request, null, $settings);

        $user = DB::transaction(function () use ($data, $request) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
                'status' => $data['status'],
            ]);
            if ($data['mark_verified'] ?? false) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }
            $user->profile()->update(['user_type' => $data['user_type'] ?? null]);
            $this->syncRoles($request, $user, $data['roles'] ?? ['member']);

            return $user;
        });

        return response()->json([
            'message' => "{$user->name} has been added.",
            'data' => new UserResource($user->load(['profile', 'roles'])),
        ], 201);
    }

    public function update(Request $request, User $user, SettingService $settings): JsonResponse
    {
        $data = $this->validated($request, $user, $settings);

        if ($user->is($request->user()) && $data['status'] !== User::STATUS_ACTIVE) {
            throw new FriendlyException("You can't suspend your own account.", 'CANNOT_CHANGE_SELF', 422);
        }

        DB::transaction(function () use ($data, $user, $request) {
            $user->fill(collect($data)->only(['name', 'email', 'phone', 'status'])->all());
            if (! empty($data['password'])) {
                $user->password = $data['password'];
            }
            if (($data['mark_verified'] ?? false) && ! $user->isVerified()) {
                $user->email_verified_at = now();
            }
            $user->save();
            $user->profile()->update(['user_type' => $data['user_type'] ?? null]);

            if (array_key_exists('roles', $data)) {
                $this->syncRoles($request, $user, $data['roles']);
            }
            if ($user->status !== User::STATUS_ACTIVE) {
                $user->tokens()->delete();
            }
        });

        return response()->json([
            'message' => 'Changes to '.$user->name.' are saved.',
            'data' => new UserResource($user->fresh(['profile', 'roles'])),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->guardRemoval($request, collect([$user]));
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => "{$user->name} moved to the bin. You can restore them later."]);
    }

    public function restore(User $user): JsonResponse
    {
        $user->restore();

        return response()->json(['message' => "{$user->name} is restored."]);
    }

    public function signOutEverywhere(User $user): JsonResponse
    {
        $count = $user->tokens()->delete();
        activity('users')->performedOn($user)->event('signed_out_everywhere')->log('Signed out of all devices by an admin');

        return response()->json(['message' => $count ? "{$user->name} has been signed out of every device." : "{$user->name} was not signed in anywhere."]);
    }

    public function resetTwoFactor(User $user, TwoFactorService $twoFactor): JsonResponse
    {
        $twoFactor->disable($user);
        $user->tokens()->delete();
        activity('users')->performedOn($user)->event('two_factor_reset')->log('Two-step sign-in reset by an admin');

        return response()->json(['message' => "Two-step sign-in reset for {$user->name}. They will set it up again next time they sign in."]);
    }

    /** POST /admin/users/bulk { action, ids[], role? } */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['activate', 'suspend', 'ban', 'delete', 'restore', 'assign_role', 'remove_role'])],
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['string'],
            'role' => ['required_if:action,assign_role,remove_role', 'nullable', 'exists:roles,name'],
        ], ['role.required_if' => 'Please choose a role.']);

        $users = User::withTrashed()->whereIn('ulid', $data['ids'])->get();
        if ($users->isEmpty()) {
            throw new FriendlyException('None of the selected people could be found.', 'NOT_FOUND', 404);
        }

        $me = $request->user();
        $affected = 0;

        DB::transaction(function () use ($data, $users, $me, $request, &$affected) {
            switch ($data['action']) {
                case 'activate':
                case 'suspend':
                case 'ban':
                    $status = ['activate' => User::STATUS_ACTIVE, 'suspend' => User::STATUS_SUSPENDED, 'ban' => User::STATUS_BANNED][$data['action']];
                    foreach ($users as $user) {
                        if ($user->is($me) || $user->status === $status) {
                            continue;
                        }
                        $user->update(['status' => $status]);
                        if ($status !== User::STATUS_ACTIVE) {
                            $user->tokens()->delete();
                        }
                        $affected++;
                    }
                    break;
                case 'delete':
                    $targets = $users->filter(fn ($u) => ! $u->trashed());
                    $this->guardRemoval($request, $targets);
                    foreach ($targets as $user) {
                        $user->tokens()->delete();
                        $user->delete();
                        $affected++;
                    }
                    break;
                case 'restore':
                    foreach ($users->filter->trashed() as $user) {
                        $user->restore();
                        $affected++;
                    }
                    break;
                case 'assign_role':
                case 'remove_role':
                    $this->ensureCanGrant($request, [$data['role']]);
                    foreach ($users as $user) {
                        if ($data['action'] === 'assign_role' && ! $user->hasRole($data['role'])) {
                            $user->assignRole($data['role']);
                            $affected++;
                        } elseif ($data['action'] === 'remove_role' && $user->hasRole($data['role'])) {
                            if ($data['role'] === 'super-admin' && $user->is($me)) {
                                continue;
                            }
                            $user->removeRole($data['role']);
                            $affected++;
                        }
                    }
                    activity('users')->causedBy($me)->event('bulk_'.$data['action'])
                        ->withProperties(['role' => $data['role'], 'users' => $users->pluck('ulid')])
                        ->log(($data['action'] === 'assign_role' ? 'Gave' : 'Removed').' role '.$data['role'].' in bulk');
                    break;
            }
        });

        $verbs = [
            'activate' => 'activated', 'suspend' => 'suspended', 'ban' => 'banned', 'delete' => 'moved to the bin',
            'restore' => 'restored', 'assign_role' => 'given the role', 'remove_role' => 'removed from the role',
        ];
        $skipped = $users->count() - $affected;
        $message = $affected === 1 ? "1 person {$verbs[$data['action']]}." : "{$affected} people {$verbs[$data['action']]}.";
        if ($skipped > 0) {
            $message .= " {$skipped} skipped (already done, or your own account).";
        }

        return response()->json(['message' => $message, 'affected' => $affected, 'skipped' => $skipped]);
    }

    private function validated(Request $request, ?User $user, SettingService $settings): array
    {
        $request->merge([
            'email' => $request->filled('email') ? mb_strtolower(trim($request->input('email'))) : null,
            'phone' => $this->auth->normalisePhone($request->input('phone')),
        ]);

        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', Rule::unique('users', 'email')->ignore($user?->id)],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:'.$settings->get('security', 'password_min_length', 10)],
            'status' => ['required', Rule::in(User::STATUSES)],
            'user_type' => ['nullable', Rule::in(['local', 'tourist'])],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['string', 'exists:roles,name'],
            'mark_verified' => ['boolean'],
        ], [
            'email.unique' => 'Someone already uses this email.',
            'phone.unique' => 'Someone already uses this phone number.',
        ]);
    }

    private function syncRoles(Request $request, User $user, array $roles): void
    {
        $this->ensureCanGrant($request, array_diff($roles, $user->getRoleNames()->all()));

        if ($user->is($request->user()) && $user->hasRole('super-admin') && ! in_array('super-admin', $roles, true)) {
            throw new FriendlyException("You can't remove your own super admin role.", 'CANNOT_CHANGE_SELF', 422);
        }

        $before = $user->getRoleNames()->sort()->values()->all();
        $user->syncRoles($roles);
        $after = $user->getRoleNames()->sort()->values()->all();

        if ($before !== $after) {
            activity('users')->performedOn($user)->causedBy($request->user())->event('roles_changed')
                ->withProperties(['old' => ['roles' => $before], 'attributes' => ['roles' => $after]])
                ->log('Roles changed');
        }
    }

    /** Only a super admin can make someone else a super admin. */
    private function ensureCanGrant(Request $request, array $roles): void
    {
        if (in_array('super-admin', $roles, true) && ! $request->user()->hasRole('super-admin')) {
            throw new FriendlyException('Only a super admin can give the super admin role.', 'FORBIDDEN', 403);
        }
    }

    private function guardRemoval(Request $request, $users): void
    {
        if ($users->contains(fn ($u) => $u->is($request->user()))) {
            throw new FriendlyException("You can't delete your own account from here.", 'CANNOT_CHANGE_SELF', 422);
        }

        $superAdmins = User::role('super-admin')->pluck('id');
        $removing = $users->pluck('id')->intersect($superAdmins);
        if ($removing->isNotEmpty() && $superAdmins->diff($removing)->isEmpty()) {
            throw new FriendlyException('At least one super admin must remain.', 'LAST_SUPER_ADMIN', 422);
        }
    }
}
