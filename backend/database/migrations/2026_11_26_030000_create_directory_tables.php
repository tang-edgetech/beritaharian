<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Phase 2: the places directory (Peta Melaka).
| A business belongs to one sector and has one or more branches (locations) on the map.
| Sector-specific details (halal, cuisine, star rating...) live in businesses.details,
| checked against the sector's attribute_schema. Reviews need proof of a visit.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('sectors')->nullOnDelete();
            $table->json('name');
            $table->json('description')->nullable();
            $table->string('slug', 80)->unique();
            $table->string('icon', 40)->default('store');
            $table->string('color', 20)->default('marigold');
            $table->json('attribute_schema')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('sector_id')->constrained()->restrictOnDelete();
            $table->json('name');
            $table->string('slug', 120)->unique();
            $table->json('description')->nullable();
            $table->string('ssm_number', 40)->nullable();
            $table->json('details')->nullable(); // sector-specific fields, see sectors.attribute_schema
            $table->json('contacts')->nullable();
            $table->string('status', 20)->default('pending')->index(); // pending, active, suspended
            $table->boolean('is_claimed')->default(false);
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->text('search_text')->nullable();
            $table->string('submitted_note', 1000)->nullable();
            $table->string('moderation_note', 1000)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'rating_avg']);
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            Schema::table('businesses', fn (Blueprint $table) => $table->fullText('search_text'));
        }

        Schema::create('business_locations', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label', 120)->nullable();
            $table->string('address', 300);
            $table->string('postcode', 10)->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('phone', 30)->nullable();
            $table->string('hours_note', 200)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->index(['latitude', 'longitude']);
        });

        // One row per opening period. Times are "HH:MM"; closes <= opens means it runs past midnight.
        Schema::create('business_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_location_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day'); // 0 Sunday ... 6 Saturday
            $table->char('opens', 5);
            $table->char('closes', 5);
            $table->index(['day', 'opens']);
        });

        Schema::create('business_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20)->default('owner'); // owner, manager
            $table->timestamps();
            $table->unique(['business_id', 'user_id']);
        });

        Schema::create('business_claims', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20)->default('owner');
            $table->string('ssm_number', 40)->nullable();
            $table->string('phone', 30);
            $table->string('note', 1000)->nullable();
            $table->string('document_path')->nullable(); // private disk
            $table->string('status', 20)->default('pending')->index(); // pending, approved, rejected
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note', 1000)->nullable();
            $table->timestamps();
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('business_location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->json('sub_ratings')->nullable();
            $table->string('title', 120)->nullable();
            $table->text('body');
            $table->date('visited_on');
            $table->boolean('is_anonymous')->default(false);
            // pending: waiting for the proof check; held: flagged by the automatic checks;
            // returned: proof not accepted; visible; removed
            $table->string('status', 20)->default('pending')->index();
            $table->json('flags')->nullable();
            $table->boolean('is_verified_visit')->default(false);
            $table->unsignedInteger('helpful_count')->default(0);
            $table->unsignedInteger('open_reports')->default(0);
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();
            $table->string('moderation_note', 1000)->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['business_id', 'status', 'published_at']);
        });

        Schema::create('visit_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('kind', 20); // receipt, checkin
            $table->string('path')->nullable(); // receipts only, private disk
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedInteger('distance_m')->nullable();
            $table->string('status', 20)->default('pending'); // pending, confirmed, rejected
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('purge_after')->nullable(); // receipt photo deleted after this
            $table->timestamps();
        });

        Schema::create('review_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('review_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['review_id', 'user_id']);
        });

        Schema::create('review_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 30);
            $table->string('note', 500)->nullable();
            $table->string('status', 20)->default('open'); // open, resolved
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->unique(['review_id', 'user_id']);
        });
    }

    public function down(): void
    {
        foreach (['review_reports', 'review_votes', 'review_replies', 'visit_proofs', 'reviews', 'business_claims', 'business_members', 'business_hours', 'business_locations', 'businesses', 'sectors'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
