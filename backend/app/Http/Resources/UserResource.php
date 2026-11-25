<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public bool $withPermissions = false;

    public function withPermissions(): static
    {
        $this->withPermissions = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->ulid,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'is_verified' => $this->isVerified(),
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'phone_verified_at' => $this->phone_verified_at?->toIso8601String(),
            'two_factor_enabled' => $this->hasTwoFactorEnabled(),
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map(fn ($role) => [
                'name' => $role->name,
                'label' => $role->label ?? $role->name,
            ])),
            'permissions' => $this->when($this->withPermissions, fn () => $this->hasRole('super-admin')
                ? ['*']
                : $this->getAllPermissions()->pluck('name')),
            'profile' => $this->whenLoaded('profile', fn () => [
                'display_name' => $this->profile?->display_name,
                'avatar_path' => $this->profile?->avatar_path,
                'user_type' => $this->profile?->user_type,
                'preferred_locale' => $this->profile?->preferred_locale,
                'bio' => $this->profile?->bio,
            ]),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
