<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Billing and light bookkeeping. Money is stored as whole sen (RM 12.50 = 1250) so sums never drift.
| Issued documents keep a JSON snapshot of seller and buyer details, so an old invoice still prints
| exactly as it was sent even after the company or customer changes address.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('number_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30);          // invoice, receipt, credit_note, expense
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('next_value')->default(1);
            $table->timestamps();
            $table->unique(['type', 'year']);
        });

        Schema::create('billing_customers', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('name', 190);
            $table->string('registration_no', 60)->nullable();   // SSM number, or IC for individuals
            $table->string('tax_id', 40)->nullable();             // LHDN TIN
            $table->string('sst_no', 40)->nullable();
            $table->string('contact_person', 120)->nullable();
            $table->string('email', 190)->nullable();
            $table->string('phone', 30)->nullable();
            $table->json('address')->nullable();                  // line1, line2, postcode, city, state, country
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index('name');
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('number', 40)->nullable()->unique(); // given only when issued, so numbers never skip
            $table->foreignId('customer_id')->constrained('billing_customers')->restrictOnDelete();
            $table->string('status', 20)->default('draft')->index(); // draft, issued, partially_paid, paid, credited, void
            $table->date('issue_date')->nullable()->index();
            $table->date('due_date')->nullable()->index();
            $table->char('currency', 3)->default('MYR');
            $table->string('reference', 120)->nullable();            // customer's PO or campaign name
            $table->unsignedBigInteger('subtotal_sen')->default(0);
            $table->unsignedBigInteger('discount_sen')->default(0);
            $table->unsignedBigInteger('tax_sen')->default(0);
            $table->unsignedBigInteger('total_sen')->default(0);
            $table->unsignedBigInteger('paid_sen')->default(0);
            $table->unsignedBigInteger('refunded_sen')->default(0);
            $table->unsignedBigInteger('credited_sen')->default(0);
            $table->json('seller')->nullable();
            $table->json('buyer')->nullable();
            $table->json('einvoice')->nullable();                    // MyInvois details once required
            $table->text('notes')->nullable();
            $table->text('terms')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('void_reason', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('description', 500);
            $table->decimal('quantity', 12, 2)->default(1);
            $table->string('unit', 20)->nullable();                  // month, post, day
            $table->unsignedBigInteger('unit_price_sen');
            $table->unsignedBigInteger('discount_sen')->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->unsignedBigInteger('tax_sen')->default(0);
            $table->unsignedBigInteger('amount_sen');                 // quantity × price − discount, before tax
            $table->nullableMorphs('billable');                      // later: plan, placement
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('receipt_number', 40)->nullable()->unique(); // receipts and refund vouchers, given on confirmation
            $table->foreignId('invoice_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('billing_customers')->restrictOnDelete();
            $table->string('kind', 10)->default('payment');          // payment (money in), refund (money out)
            $table->string('method', 20);                            // bank_transfer, duitnow, cash, cheque, card, ewallet, other
            $table->string('reference', 120)->nullable();            // bank reference, cheque number
            $table->unsignedBigInteger('amount_sen');
            $table->date('paid_on')->index();
            $table->string('status', 12)->default('pending')->index(); // pending, confirmed, rejected
            $table->string('slip_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->string('rejected_reason', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('credit_notes', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('number', 40)->unique();
            $table->foreignId('invoice_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('billing_customers')->restrictOnDelete();
            $table->date('issue_date')->index();
            $table->string('reason', 255);
            $table->string('description', 500);
            $table->unsignedBigInteger('subtotal_sen');
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->unsignedBigInteger('tax_sen')->default(0);
            $table->unsignedBigInteger('total_sen');
            $table->json('seller')->nullable();
            $table->json('buyer')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('number', 40)->unique();
            $table->date('spent_on')->index();
            $table->string('category', 60)->index();
            $table->string('payee', 190);
            $table->string('description', 500);
            $table->string('reference', 120)->nullable();            // supplier's bill or receipt number
            $table->string('method', 20);
            $table->unsignedBigInteger('amount_sen');
            $table->unsignedBigInteger('tax_sen')->default(0);
            $table->unsignedBigInteger('total_sen');
            $table->string('attachment_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('credit_notes');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('billing_customers');
        Schema::dropIfExists('number_sequences');
    }
};
