<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Human-readable names for roles and permissions, so the admin never shows raw keys like "users.update". */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('label')->nullable()->after('name');
            $table->string('description')->nullable()->after('label');
            $table->boolean('is_system')->default(false)->after('description'); // cannot be deleted or renamed
            $table->unsignedInteger('position')->default(0)->after('is_system');
        });

        Schema::table('permissions', function (Blueprint $table) {
            $table->string('label')->nullable()->after('name');
            $table->string('group', 40)->nullable()->after('label')->index();
        });
    }

    public function down(): void
    {
        Schema::table('roles', fn (Blueprint $table) => $table->dropColumn(['label', 'description', 'is_system', 'position']));
        Schema::table('permissions', fn (Blueprint $table) => $table->dropColumn(['label', 'group']));
    }
};
