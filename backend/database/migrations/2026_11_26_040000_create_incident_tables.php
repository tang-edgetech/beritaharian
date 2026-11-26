<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Phase 3: civic reports.
| A reader reports an incident from the map with photos or videos. Original files are stored
| privately and never changed; each gets a SHA-256 hash at upload. Verifiers check the report,
| ask the reporter for more, and either publish a public alert (written by staff, with blurred
| photos uploaded separately), keep it private, or reject it with a reason. Evidence packs for
| the police are logged as handovers with the hash of their manifest.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_types', function (Blueprint $table) {
            $table->id();
            $table->json('name');
            $table->json('description')->nullable();
            $table->string('slug', 80)->unique();
            $table->string('icon', 40)->default('alert-triangle');
            $table->string('color', 20)->default('satay');
            $table->string('default_severity', 10)->default('medium');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('reference_no', 30)->unique();
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('incident_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('address', 300)->nullable();      // what the reporter typed, e.g. "near the Jonker Walk arch"
            $table->timestamp('occurred_at');
            $table->string('title', 150);
            $table->text('description');
            $table->boolean('is_anonymous_public')->default(false);
            $table->string('status', 20)->default('new')->index(); // new, needs_info, investigating, verified, unconfirmed, rejected, closed, withdrawn
            $table->string('severity', 10)->default('medium');   // low, medium, high, critical
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('duplicate_of_id')->nullable()->constrained('incidents')->nullOnDelete();
            $table->json('checklist')->nullable();               // verifier's checks: photos match place, time plausible, ...
            $table->string('decision_note', 1000)->nullable();   // reason shown to the reporter when rejected or unconfirmed
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();

            // the public alert, written by staff; the reporter's own words are never shown publicly
            $table->string('public_title', 150)->nullable();
            $table->text('public_summary')->nullable();
            $table->string('public_address', 200)->nullable();
            $table->timestamp('alert_published_at')->nullable()->index();
            $table->timestamp('resolved_at')->nullable();

            $table->string('submitted_ip', 45)->nullable();
            $table->timestamp('consented_at')->nullable();       // PDPA notice accepted when sending
            $table->timestamp('reporter_replied_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['latitude', 'longitude']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('incident_evidences', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source', 10)->default('reporter');   // reporter, staff
            $table->string('kind', 10);                          // image, video, audio, document
            $table->string('disk_path', 300)->nullable();        // null once purged
            $table->string('original_name', 200);
            $table->string('mime', 100);
            $table->unsignedBigInteger('size');
            $table->char('sha256', 64);
            $table->json('exif')->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->string('uploader_ip', 45)->nullable();
            $table->string('user_agent', 300)->nullable();
            $table->timestamp('purged_at')->nullable();
            $table->timestamps();
        });

        // The timeline: status changes, internal notes, messages to and from the reporter.
        Schema::create('incident_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('kind', 20);                          // submitted, status, note, message, reply, evidence, assigned, alert, handover
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20)->nullable();
            $table->text('body')->nullable();
            $table->boolean('visible_to_reporter')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['incident_id', 'created_at']);
        });

        Schema::create('evidence_handovers', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('incident_id')->constrained()->restrictOnDelete();
            $table->foreignId('exported_by')->constrained('users')->restrictOnDelete();
            $table->string('agency', 150);                       // e.g. PDRM IPD Melaka Tengah
            $table->string('officer_name', 150);
            $table->string('officer_id', 60)->nullable();        // badge or service number
            $table->string('police_report_no', 80);
            $table->string('notes', 1000)->nullable();
            $table->json('evidence_ids');
            $table->string('pack_path', 300)->nullable();
            $table->unsignedBigInteger('pack_size')->default(0);
            $table->char('manifest_sha256', 64);
            $table->char('pack_sha256', 64);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evidence_handovers');
        Schema::dropIfExists('incident_updates');
        Schema::dropIfExists('incident_evidences');
        Schema::dropIfExists('incidents');
        Schema::dropIfExists('incident_types');
    }
};
