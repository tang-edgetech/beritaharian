<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exceptions\FriendlyException;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions:id,name')->orderBy('position')->get();

        $counts = $this->userCounts();

        return response()->json(['data' => $roles->map(fn (Role $role) => $this->present($role, $counts))]);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json(['data' => $this->present($role->load('permissions:id,name'))]);
    }

    /** Permissions grouped by area, with human labels, for the role editor. */
    public function permissions(): JsonResponse
    {
        $groups = Permission::orderBy('group')->orderBy('name')->get()
            ->groupBy('group')
            ->map(fn ($items, $group) => [
                'group' => $group,
                'label' => Str::headline($group),
                'permissions' => $items->map(fn ($p) => ['name' => $p->name, 'label' => $p->label ?? $p->name])->values(),
            ])
            ->values();

        return response()->json(['data' => $groups]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $name = Str::slug($data['label']);

        if (Role::where('name', $name)->exists()) {
            throw new FriendlyException('A role with this name already exists.', 'ROLE_EXISTS', 422);
        }

        $role = DB::transaction(function () use ($data, $name) {
            $role = Role::create([
                'name' => $name,
                'guard_name' => 'web',
                'label' => $data['label'],
                'description' => $data['description'] ?? null,
                'position' => (int) Role::max('position') + 1,
            ]);
            $role->syncPermissions($data['permissions'] ?? []);

            return $role;
        });

        activity('roles')->performedOn($role)->causedBy($request->user())->event('created')
            ->withProperties(['attributes' => ['label' => $role->label, 'permissions' => $data['permissions'] ?? []]])
            ->log('Role created');

        return response()->json(['message' => "Role \"{$role->label}\" created.", 'data' => $this->present($role)], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if ($role->name === 'super-admin') {
            throw new FriendlyException('The super admin role always has every permission and cannot be edited.', 'ROLE_LOCKED', 422);
        }

        $data = $this->validated($request);
        $before = ['label' => $role->label, 'description' => $role->description, 'permissions' => $role->permissions->pluck('name')->sort()->values()->all()];

        DB::transaction(function () use ($role, $data) {
            $role->update([
                // system roles keep their label so code that relies on them stays clear
                'label' => $role->is_system ? $role->label : $data['label'],
                'description' => $data['description'] ?? null,
            ]);
            $role->syncPermissions($data['permissions'] ?? []);
        });
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $after = ['label' => $role->label, 'description' => $role->description, 'permissions' => $role->fresh()->permissions->pluck('name')->sort()->values()->all()];
        activity('roles')->performedOn($role)->causedBy($request->user())->event('updated')
            ->withProperties(['old' => $before, 'attributes' => $after])
            ->log('Role updated');

        return response()->json(['message' => "Role \"{$role->label}\" saved.", 'data' => $this->present($role)]);
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        if ($role->is_system) {
            throw new FriendlyException('This is a built-in role and cannot be deleted.', 'ROLE_LOCKED', 422);
        }
        $count = $this->userCounts()[$role->id] ?? 0;
        if ($count > 0) {
            throw new FriendlyException("{$count} people still have this role. Move them to another role first.", 'ROLE_IN_USE', 422);
        }

        $label = $role->label;
        $role->delete();
        activity('roles')->causedBy($request->user())->event('deleted')->withProperties(['old' => ['label' => $label]])->log('Role deleted');

        return response()->json(['message' => "Role \"{$label}\" deleted."]);
    }

    /** PUT /admin/roles/order { names: [...] } — saves drag-and-drop order */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['names' => ['required', 'array'], 'names.*' => ['string', 'exists:roles,name']]);
        foreach ($data['names'] as $position => $name) {
            Role::where('name', $name)->update(['position' => $position]);
        }

        return response()->json(['message' => 'New order saved.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:200'],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')],
        ]);
    }

    /**
     * People per role, counted straight from the pivot table. (Spatie's Role::users() relation
     * resolves the user model from the current auth guard, which is "sanctum" on API requests
     * and has no model, so withCount('users') cannot be used here.)
     */
    private function userCounts(): array
    {
        return DB::table(config('permission.table_names.model_has_roles'))
            ->where('model_type', User::class)
            ->selectRaw('role_id, count(*) as total')
            ->groupBy('role_id')
            ->pluck('total', 'role_id')
            ->all();
    }

    private function present(Role $role, ?array $counts = null): array
    {
        return [
            'name' => $role->name,
            'label' => $role->label ?? Str::headline($role->name),
            'description' => $role->description,
            'is_system' => (bool) $role->is_system,
            'is_locked' => $role->name === 'super-admin',
            'position' => $role->position,
            'users_count' => ($counts ?? $this->userCounts())[$role->id] ?? 0,
            'permissions' => $role->name === 'super-admin' ? ['*'] : $role->permissions->pluck('name')->values(),
        ];
    }
}
