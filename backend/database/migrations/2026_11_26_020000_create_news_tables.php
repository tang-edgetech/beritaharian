<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| News, plus the shared tables later phases reuse: areas (Melaka places), tags and media.
| Text people read is stored per language as JSON ({"en": "...", "ms": "..."}) so BM and Chinese
| can be added without changing the tables. Article bodies are rich-text documents (JSON), never raw HTML.
*/
return new class extends Migration
{
    public function up(): void
    {
        // Melaka Tengah › Bandar Hilir … also used by the directory and civic reports
        Schema::create('areas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('areas')->nullOnDelete();
            $table->string('type', 20);                    // district, locality
            $table->json('name');
            $table->string('slug', 80)->unique();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->json('name');
            $table->json('description')->nullable();
            $table->string('slug', 80)->unique();
            $table->string('color', 20)->default('pandan');  // brand colour key used for chips
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('slug', 80)->unique();
            $table->timestamps();
        });

        Schema::create('taggables', function (Blueprint $table) {
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->morphs('taggable');
            $table->primary(['tag_id', 'taggable_id', 'taggable_type']);
        });

        // One table for every picture on the site: article covers now, listing galleries and evidence later
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->nullableMorphs('mediable');
            $table->string('collection', 30)->default('default'); // cover, inline, gallery
            $table->string('disk', 20)->default('media');
            $table->string('directory');                          // folder holding the resized copies
            $table->json('variants');                             // { thumb: "x-400.webp", card: …, large: … }
            $table->string('mime', 60);
            $table->unsignedInteger('size');
            $table->json('meta')->nullable();                     // width, height, alt, caption, credit
            $table->unsignedInteger('position')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->json('title');
            $table->string('slug', 190)->unique();               // one stable link per story
            $table->json('excerpt')->nullable();
            $table->json('body')->nullable();                     // rich-text document per language
            $table->longText('search_text')->nullable();          // plain text for search
            $table->string('status', 20)->default('draft')->index(); // draft, in_review, verified, scheduled, published, archived
            $table->string('truth_label', 20)->nullable();        // verified, developing, corrected
            $table->boolean('is_breaking')->default(false)->index();
            $table->boolean('is_featured')->default(false);       // editor's pick for the lead slot
            $table->unsignedSmallInteger('reading_minutes')->default(1);
            $table->text('review_note')->nullable();              // latest note from verifier or editor
            $table->string('archived_reason', 255)->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable()->index();
            $table->timestamp('corrected_at')->nullable();
            $table->unsignedBigInteger('view_count')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            Schema::table('articles', fn (Blueprint $table) => $table->fullText('search_text'));
        }

        Schema::create('article_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20);                           // official, witness, document, media
            $table->string('label', 190);
            $table->string('url', 500)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('article_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained()->cascadeOnDelete();
            $table->foreignId('editor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('snapshot');
            $table->string('change_note', 255)->nullable();
            $table->boolean('is_public_correction')->default(false);
            $table->timestamp('created_at')->useCurrent();
        });

        // counted once per visitor per day, so refreshing doesn't inflate "most read"
        Schema::create('article_daily_views', function (Blueprint $table) {
            $table->foreignId('article_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->unsignedInteger('views')->default(0);
            $table->primary(['article_id', 'day']);
        });
    }

    public function down(): void
    {
        foreach (['article_daily_views', 'article_revisions', 'article_sources', 'articles', 'media', 'taggables', 'tags', 'categories', 'areas'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
