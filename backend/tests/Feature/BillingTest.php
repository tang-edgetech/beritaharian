<?php

namespace Tests\Feature;

use App\Models\Billing\Invoice;
use App\Models\User;
use App\Support\Money;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    private User $boss;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->boss = User::factory()->create(['name' => 'Boss']);
        $this->boss->assignRole('super-admin');
        $this->boss->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();
        Sanctum::actingAs($this->boss, ['*']);
    }

    private function customer(string $name = 'Kedai Kopi Jonker'): string
    {
        return $this->postJson('/api/v1/admin/billing/customers', [
            'name' => $name,
            'registration_no' => '202601012345',
            'email' => 'kopi@example.com',
            'address' => ['line1' => '12 Jalan Hang Jebat', 'postcode' => '75200', 'city' => 'Melaka', 'state' => 'Melaka', 'country' => 'Malaysia'],
        ])->assertCreated()->json('data.id');
    }

    private function draft(string $customerId, ?array $lines = null, bool $issue = false): array
    {
        return $this->postJson('/api/v1/admin/billing/invoices', [
            'customer_id' => $customerId,
            'issue_date' => today()->toDateString(),
            'issue' => $issue,
            'lines' => $lines ?? [
                ['description' => 'Pinned post on home page', 'quantity' => 2, 'unit' => 'week', 'unit_price' => '150.00'],
                ['description' => 'Shout-out strip', 'quantity' => 1, 'unit_price' => '80.50', 'discount' => '10.50'],
            ],
        ])->assertCreated()->json('data');
    }

    public function test_draft_totals_and_issue_gives_running_numbers(): void
    {
        $customer = $this->customer();
        $draft = $this->draft($customer);

        $this->assertNull($draft['number']);
        $this->assertSame('draft', $draft['status']);
        $this->assertSame(38050, $draft['subtotal_sen']);
        $this->assertSame(1050, $draft['discount_sen']);
        $this->assertSame(37000, $draft['total_sen']);

        $year = today()->year;
        $this->postJson("/api/v1/admin/billing/invoices/{$draft['id']}/issue")->assertOk()
            ->assertJsonPath('data.number', "CS-INV-{$year}-000001")
            ->assertJsonPath('data.status', 'issued')
            ->assertJsonPath('data.buyer.name', 'Kedai Kopi Jonker')
            ->assertJsonPath('data.due_date', today()->addDays(14)->toDateString());

        $second = $this->draft($customer, issue: true);
        $this->assertSame("CS-INV-{$year}-000002", $second['number']);

        // issued invoices are locked
        $this->putJson("/api/v1/admin/billing/invoices/{$draft['id']}", [
            'customer_id' => $customer, 'lines' => [['description' => 'x', 'quantity' => 1, 'unit_price' => 1]],
        ])->assertStatus(422)->assertJsonPath('code', 'INVOICE_LOCKED');
        $this->deleteJson("/api/v1/admin/billing/invoices/{$draft['id']}")->assertStatus(422);
    }

    public function test_payments_credit_notes_and_refunds_keep_the_balance_right(): void
    {
        $invoice = $this->draft($this->customer(), issue: true); // RM 370.00
        $base = "/api/v1/admin/billing/invoices/{$invoice['id']}";

        $this->postJson("{$base}/payments", ['kind' => 'payment', 'method' => 'bank_transfer', 'amount' => 400, 'paid_on' => today()->toDateString(), 'confirm' => true])
            ->assertStatus(422)->assertJsonPath('code', 'AMOUNT_TOO_HIGH');

        $payment = $this->postJson("{$base}/payments", ['kind' => 'payment', 'method' => 'duitnow', 'reference' => 'DN123', 'amount' => 200, 'paid_on' => today()->toDateString(), 'confirm' => true])
            ->assertCreated()->assertJsonPath('data.status', 'confirmed')->json('data');
        $this->assertSame('CS-RCP-'.today()->year.'-000001', $payment['receipt_number']);

        $this->getJson($base)->assertJsonPath('data.status', 'partially_paid')->assertJsonPath('data.balance_sen', 17000);

        $this->postJson("{$base}/payments", ['kind' => 'payment', 'method' => 'cash', 'amount' => 170, 'paid_on' => today()->toDateString(), 'confirm' => true])->assertCreated();
        $this->getJson($base)->assertJsonPath('data.status', 'paid')->assertJsonPath('data.balance_sen', 0);

        // campaign cut short: credit RM 100, then refund it
        $this->postJson("{$base}/credit-notes", ['issue_date' => today()->toDateString(), 'reason' => 'Campaign ended early', 'description' => 'One week of pinned post not used', 'amount' => 100])
            ->assertCreated()->assertJsonPath('data.number', 'CS-CN-'.today()->year.'-000001');
        $this->getJson($base)->assertJsonPath('data.balance_sen', -10000);

        $this->postJson("{$base}/payments", ['kind' => 'refund', 'method' => 'bank_transfer', 'amount' => 150, 'paid_on' => today()->toDateString(), 'confirm' => true])
            ->assertStatus(422);
        $this->postJson("{$base}/payments", ['kind' => 'refund', 'method' => 'bank_transfer', 'amount' => 100, 'paid_on' => today()->toDateString(), 'confirm' => true])
            ->assertCreated()->assertJsonPath('data.receipt_number', 'CS-RFD-'.today()->year.'-000001');

        $this->getJson($base)->assertJsonPath('data.status', 'paid')->assertJsonPath('data.balance_sen', 0)
            ->assertJsonPath('data.paid_sen', 37000)->assertJsonPath('data.refunded_sen', 10000)->assertJsonPath('data.credited_sen', 10000);

        // with money on it, it can't be voided
        $this->postJson("{$base}/void", ['reason' => 'Mistake'])->assertStatus(422)->assertJsonPath('code', 'INVOICE_HAS_ACTIVITY');
    }

    public function test_finance_role_records_payments_but_cannot_confirm_them(): void
    {
        $invoice = $this->draft($this->customer(), issue: true);
        $clerk = User::factory()->create();
        $clerk->assignRole('finance');
        Sanctum::actingAs($clerk, ['*']);

        $payment = $this->postJson("/api/v1/admin/billing/invoices/{$invoice['id']}/payments", [
            'kind' => 'payment', 'method' => 'bank_transfer', 'amount' => 370, 'paid_on' => today()->toDateString(), 'confirm' => true,
        ])->assertCreated()->assertJsonPath('data.status', 'pending')->json('data');

        $this->postJson("/api/v1/admin/billing/payments/{$payment['id']}/confirm")->assertForbidden();
        $this->postJson("/api/v1/admin/billing/invoices/{$invoice['id']}/void", ['reason' => 'x'])->assertForbidden();

        Sanctum::actingAs($this->boss, ['*']);
        $this->postJson('/api/v1/admin/billing/payments/bulk', ['action' => 'confirm', 'ids' => [$payment['id']]])
            ->assertOk()->assertJsonPath('affected', 1);
        $this->getJson("/api/v1/admin/billing/invoices/{$invoice['id']}")->assertJsonPath('data.status', 'paid');
    }

    public function test_void_keeps_the_number_and_drops_out_of_reports(): void
    {
        $customer = $this->customer();
        $keep = $this->draft($customer, issue: true);
        $void = $this->draft($customer, issue: true);

        $this->postJson("/api/v1/admin/billing/invoices/{$void['id']}/void", ['reason' => 'Wrong customer'])
            ->assertOk()->assertJsonPath('data.status', 'void')->assertJsonPath('data.number', $void['number']);

        $report = $this->getJson('/api/v1/admin/billing/reports/sales?from='.today()->startOfYear()->toDateString().'&to='.today()->toDateString())
            ->assertOk()->json('data');
        $this->assertCount(1, $report['tables'][0]['rows']);
        $this->assertSame($keep['number'], $report['tables'][0]['rows'][0]['number']);
        $this->assertSame(37000, $report['tables'][0]['totals']['total']);

        $this->getJson("/api/v1/admin/billing/customers/{$customer}")->assertJsonPath('data.balance_sen', 37000);
    }

    public function test_documents_and_reports_print_as_pdf_and_csv(): void
    {
        $customer = $this->customer();
        $invoice = $this->draft($customer, issue: true);
        $payment = $this->postJson("/api/v1/admin/billing/invoices/{$invoice['id']}/payments", [
            'kind' => 'payment', 'method' => 'cash', 'amount' => 100, 'paid_on' => today()->toDateString(), 'confirm' => true,
        ])->json('data');

        $pdf = $this->get("/api/v1/admin/billing/invoices/{$invoice['id']}/pdf")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $this->get("/api/v1/admin/billing/payments/{$payment['id']}/receipt")->assertOk()->assertHeader('content-type', 'application/pdf');

        foreach (['sales', 'collections', 'outstanding', 'income-expenses', 'expenses', 'tax'] as $type) {
            $this->get("/api/v1/admin/billing/reports/{$type}?format=pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
        }

        $csv = $this->get('/api/v1/admin/billing/reports/collections?format=csv')->assertOk();
        $this->assertStringContainsString('100.00', $csv->streamedContent());

        $statement = $this->getJson("/api/v1/admin/billing/customers/{$customer}/statement?from=".today()->startOfMonth()->toDateString().'&to='.today()->toDateString())
            ->assertOk()->json('data');
        $this->assertSame(27000, $statement['tables'][0]['totals']['balance']);
    }

    public function test_expenses_get_numbers_keep_bills_private_and_count_in_income_report(): void
    {
        Storage::fake('local');

        $expense = $this->post('/api/v1/admin/billing/expenses', [
            'spent_on' => today()->toDateString(), 'category' => 'Hosting & software', 'payee' => 'Web host',
            'description' => 'cPanel hosting, 1 year', 'method' => 'card', 'amount' => '480', 'tax' => '38.40',
            'attachment' => UploadedFile::fake()->create('bill.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertSame('CS-EXP-'.today()->year.'-000001', $expense['number']);
        $this->assertSame(51840, $expense['total_sen']);
        $this->assertTrue($expense['has_attachment']);
        $this->get("/api/v1/admin/billing/expenses/{$expense['id']}/attachment")->assertOk();

        $invoice = $this->draft($this->customer(), issue: true);
        $this->postJson("/api/v1/admin/billing/invoices/{$invoice['id']}/payments", [
            'kind' => 'payment', 'method' => 'cash', 'amount' => 370, 'paid_on' => today()->toDateString(), 'confirm' => true,
        ]);

        $report = $this->getJson('/api/v1/admin/billing/reports/income-expenses?from='.today()->startOfMonth()->toDateString().'&to='.today()->toDateString())->json('data');
        $this->assertSame(37000 - 51840, $report['tables'][0]['totals']['net']);
    }

    public function test_amounts_in_words(): void
    {
        $this->assertSame('Ringgit Malaysia One Thousand Two Hundred Thirty Four and Sen Fifty Only', Money::words(123450));
        $this->assertSame('Ringgit Malaysia Seventy Only', Money::words(7000));
        $this->assertSame('RM 1,234.50', Money::format(123450));
        $this->assertSame(Invoice::DRAFT, 'draft');
    }
}
