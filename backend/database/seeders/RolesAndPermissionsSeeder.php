<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /** Permissions grouped by area. Later phases add news.*, directory.*, incidents.* and so on. */
    public const PERMISSIONS = [
        'users' => [
            'users.view' => 'View users',
            'users.create' => 'Add users',
            'users.update' => 'Edit users',
            'users.delete' => 'Delete users',
        ],
        'roles' => [
            'roles.manage' => 'Manage roles and permissions',
        ],
        'settings' => [
            'settings.manage' => 'Change site settings',
        ],
        'news' => [
            'news.write' => 'Write stories (own drafts)',
            'news.edit_any' => 'Edit anyone\'s stories',
            'news.verify' => 'Fact-check and verify stories',
            'news.publish' => 'Publish, schedule and take down stories',
            'news.delete' => 'Delete drafts and archived stories',
            'news.categories' => 'Manage news categories',
        ],
        'billing' => [
            'billing.view' => 'View invoices, payments, customers and expenses',
            'billing.manage' => 'Prepare invoices, record payments and expenses',
            'billing.approve' => 'Confirm payments, void invoices and issue credit notes',
            'billing.reports' => 'Print finance reports and statements',
        ],
        'logs' => [
            'audit.view' => 'View the audit log',
            'logs.view' => 'View sign-in and system logs',
        ],
        'admin' => [
            'admin.access' => 'Sign in to the admin panel',
        ],
    ];

    /** Super admin gets everything through a Gate::before check, so it is not listed here. */
    public const ROLES = [
        'super-admin' => ['label' => 'Super admin', 'description' => 'Full access to everything, including settings and roles.', 'system' => true, 'permissions' => []],
        'admin' => ['label' => 'Admin', 'description' => 'Runs the site day to day: users, settings, news, billing and logs.', 'system' => false, 'permissions' => ['admin.access', 'users.view', 'users.create', 'users.update', 'users.delete', 'settings.manage', 'audit.view', 'logs.view', 'news.write', 'news.edit_any', 'news.publish', 'news.delete', 'news.categories', 'billing.view', 'billing.manage', 'billing.approve', 'billing.reports']],
        'finance' => ['label' => 'Finance', 'description' => 'Prepares invoices, records payments and expenses, prints reports. Confirming payments needs approval rights.', 'system' => false, 'permissions' => ['admin.access', 'billing.view', 'billing.manage', 'billing.reports']],
        'editor' => ['label' => 'Editor', 'description' => 'Approves and publishes news.', 'system' => false, 'permissions' => ['admin.access', 'news.write', 'news.edit_any', 'news.publish', 'news.delete', 'news.categories']],
        'journalist' => ['label' => 'Journalist', 'description' => 'Writes news drafts.', 'system' => false, 'permissions' => ['admin.access', 'news.write']],
        'verifier' => ['label' => 'Verifier', 'description' => 'Fact-checks news and incident reports.', 'system' => false, 'permissions' => ['admin.access', 'news.verify']],
        'moderator' => ['label' => 'Moderator', 'description' => 'Reviews listings, claims and reviews.', 'system' => false, 'permissions' => ['admin.access', 'users.view']],
        'business-owner' => ['label' => 'Business owner', 'description' => 'Manages their own business listings.', 'system' => true, 'permissions' => []],
        'member' => ['label' => 'Member', 'description' => 'Every registered person. Can review and report.', 'system' => true, 'permissions' => []],
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $added = [];
        foreach (self::PERMISSIONS as $group => $permissions) {
            foreach ($permissions as $name => $label) {
                $permission = Permission::updateOrCreate(['name' => $name, 'guard_name' => 'web'], ['label' => $label, 'group' => $group]);
                if ($permission->wasRecentlyCreated) {
                    $added[] = $name;
                }
            }
        }

        $position = 0;
        foreach (self::ROLES as $name => $role) {
            $model = Role::updateOrCreate(['name' => $name, 'guard_name' => 'web'], [
                'label' => $role['label'],
                'description' => $role['description'],
                'is_system' => $role['system'],
                'position' => $position++,
            ]);
            // only fill permissions on first seed, so admin changes are not overwritten
            if ($model->wasRecentlyCreated) {
                $model->syncPermissions($role['permissions']);
            } elseif ($new = array_intersect($role['permissions'], $added)) {
                // a later phase added permissions: give them to the roles that should have them, keep the rest as admins set it
                $model->givePermissionTo($new);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
