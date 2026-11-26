<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([RolesAndPermissionsSeeder::class, NewsSeeder::class, DirectorySeeder::class]);

        // The first super admin. Credentials come from .env (SEED_ADMIN_*), never from code.
        $email = env('SEED_ADMIN_EMAIL');
        $password = env('SEED_ADMIN_PASSWORD');

        if ($email && $password && ! User::where('email', $email)->exists()) {
            $admin = User::create([
                'name' => env('SEED_ADMIN_NAME', 'Super Admin'),
                'email' => $email,
                'password' => $password,
            ]);
            $admin->forceFill(['email_verified_at' => now()])->save();
            $admin->assignRole('super-admin');
            $this->command?->info("Super admin created: {$email}");
        }
    }
}
