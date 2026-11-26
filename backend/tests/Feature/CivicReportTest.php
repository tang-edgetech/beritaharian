<?php

namespace Tests\Feature;

use App\Models\Civic\Incident;
use App\Models\Civic\IncidentEvidence;
use App\Models\User;
use App\Notifications\IncidentUpdateNotification;
use App\Services\Civic\IncidentService;
use Database\Seeders\IncidentTypeSeeder;
use Database\Seeders\NewsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;
use ZipArchive;

class CivicReportTest extends TestCase
{
    use RefreshDatabase;

    private User $verifier;

    private User $reader;

    // Jonker Street-ish
    private const LAT = 2.19530;

    private const LNG = 102.24710;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, NewsSeeder::class, IncidentTypeSeeder::class]);
        $this->verifier = User::factory()->create(['name' => 'Vera Verifier']);
        $this->verifier->assignRole('verifier');
        $this->reader = User::factory()->create(['name' => 'Siti Reader']);
        Storage::fake('local');
        Storage::fake('media');
        Notification::fake();
    }

    private function report(array $overrides = [], ?array $files = null): array
    {
        Sanctum::actingAs($this->reader, ['*']);

        return $this->post('/api/v1/me/reports', array_merge([
            'type' => 'flood',
            'latitude' => self::LAT,
            'longitude' => self::LNG,
            'address' => 'Near the Jonker Walk arch',
            'occurred_at' => now()->subHour()->toIso8601String(),
            'title' => 'Road flooded after the rain',
            'description' => 'Water is knee deep in front of the shops, cars are turning back.',
            'is_anonymous' => true,
            'consent' => true,
            'files' => $files ?? [UploadedFile::fake()->image('flood.jpg', 800, 600)],
        ], $overrides), ['Accept' => 'application/json'])->assertCreated()->json('data');
    }

    private function act(string $ref, array $data, ?User $as = null)
    {
        Sanctum::actingAs($as ?? $this->verifier, ['*']);

        return $this->postJson("/api/v1/admin/incidents/{$ref}/action", $data);
    }

    public function test_reader_sends_a_report_and_files_are_kept_with_their_hash(): void
    {
        $data = $this->report();

        $this->assertMatchesRegularExpression('/^MLK-\d{4}-000001$/', $data['ref']);
        $this->assertSame('Received', $data['status_label']);
        $this->assertSame('jonker-street', $data['area']['slug']);
        $this->assertCount(1, $data['files']);

        $evidence = IncidentEvidence::first();
        $this->assertSame('image', $evidence->kind);
        $this->assertSame($evidence->sha256, hash('sha256', Storage::disk('local')->get($evidence->disk_path)));
        $this->assertNotNull(Incident::first()->consented_at);

        // a second report gets the next number
        $this->assertStringEndsWith('-000002', $this->report()['ref']);
    }

    public function test_report_must_be_inside_melaka_with_consent(): void
    {
        Sanctum::actingAs($this->reader, ['*']);
        $this->postJson('/api/v1/me/reports', [
            'type' => 'flood', 'latitude' => 3.1390, 'longitude' => 101.6869, 'occurred_at' => now()->toIso8601String(),
            'title' => 'Flood in KL', 'description' => 'This is outside Melaka so it should be stopped.',
        ])->assertUnprocessable()->assertJsonValidationErrors(['latitude', 'longitude', 'consent']);
    }

    public function test_other_readers_cannot_see_a_report_and_readers_cannot_open_the_queue(): void
    {
        $ref = $this->report()['ref'];
        $other = User::factory()->create();
        Sanctum::actingAs($other, ['*']);
        $this->getJson("/api/v1/me/reports/{$ref}")->assertNotFound();
        $this->getJson('/api/v1/admin/incidents')->assertForbidden();
    }

    public function test_verifier_asks_for_more_and_the_reply_puts_it_back_in_the_queue(): void
    {
        $ref = $this->report()['ref'];

        $this->act($ref, ['action' => 'request_info'])->assertUnprocessable();
        $this->act($ref, ['action' => 'request_info', 'message' => 'Can you send a photo showing the street sign?'])
            ->assertOk()->assertJsonPath('data.status', 'needs_info')->assertJsonPath('data.assignee.name', 'Vera Verifier');
        Notification::assertSentTo($this->reader, IncidentUpdateNotification::class);

        Sanctum::actingAs($this->reader, ['*']);
        $mine = $this->getJson("/api/v1/me/reports/{$ref}")->assertOk()->json('data');
        $this->assertTrue($mine['needs_reply']);
        $this->assertSame('Can you send a photo showing the street sign?', collect($mine['timeline'])->firstWhere('kind', 'message')['body']);
        $this->assertSame('team', collect($mine['timeline'])->firstWhere('kind', 'message')['from']);

        $this->post("/api/v1/me/reports/{$ref}/updates", ['message' => 'Here it is.', 'files' => [UploadedFile::fake()->image('sign.jpg')]], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.status', 'new')->assertJsonCount(2, 'data.files');

        Sanctum::actingAs($this->verifier, ['*']);
        $this->getJson('/api/v1/admin/incidents?filter[queue]=check')->assertOk()->assertJsonPath('data.0.reporter_replied', true);
    }

    public function test_verified_alert_shows_only_staff_text_and_hides_the_reporter(): void
    {
        $ref = $this->report()['ref'];
        $this->act($ref, ['action' => 'verify', 'publish_alert' => true])->assertUnprocessable()->assertJsonPath('code', 'ALERT_TEXT_NEEDED');
        $this->act($ref, [
            'action' => 'verify', 'publish_alert' => true, 'severity' => 'high',
            'checklist' => ['location_matches' => true, 'second_source' => true],
            'public_title' => 'Flash flood on Jalan Hang Jebat',
            'public_summary' => 'Water about 40 cm deep. Drivers are advised to use Jalan Kota.',
            'public_address' => 'Jalan Hang Jebat',
        ])->assertOk()->assertJsonPath('data.status', 'verified')->assertJsonPath('data.is_alert', true)
            ->assertJsonPath('data.checklist.location_matches', true)->assertJsonPath('data.checklist.faces_blurred', false);

        $list = $this->getJson('/api/v1/public/alerts')->assertOk()->assertJsonPath('data.0.ref', $ref)->assertJsonPath('data.0.state', 'active');
        $this->assertStringNotContainsString('knee deep', $list->getContent());

        $alert = $this->getJson("/api/v1/public/alerts/{$ref}")->assertOk()->json('data');
        $this->assertSame('A Cendol Satay reader', $alert['reported_by']);
        $this->assertArrayNotHasKey('description', $alert);
        $this->getJson('/api/v1/public/alerts/pins')->assertOk()->assertJsonCount(1, 'data');

        // closing marks it resolved and moves it out of the active list
        $this->act($ref, ['action' => 'close'])->assertOk();
        $this->getJson('/api/v1/public/alerts')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/public/alerts?state=resolved')->assertJsonPath('data.0.state', 'resolved');

        // taking the alert down hides it completely
        Sanctum::actingAs($this->verifier, ['*']);
        $this->putJson("/api/v1/admin/incidents/{$ref}/alert", ['published' => false])->assertOk();
        $this->getJson("/api/v1/public/alerts/{$ref}")->assertNotFound();
    }

    public function test_nobody_verifies_their_own_report(): void
    {
        Sanctum::actingAs($this->verifier, ['*']);
        $this->reader = $this->verifier;
        $ref = $this->report()['ref'];
        $this->act($ref, ['action' => 'verify'])->assertForbidden()->assertJsonPath('code', 'OWN_REPORT');
    }

    public function test_rejected_report_tells_the_reporter_why_and_stays_private(): void
    {
        $first = $this->report()['ref'];
        $ref = $this->report()['ref'];
        $this->act($ref, ['action' => 'reject', 'message' => 'Someone already reported this.', 'duplicate_of' => 'MLK-0000-000000'])->assertUnprocessable();
        $this->act($ref, ['action' => 'reject', 'message' => 'Someone already reported this.', 'duplicate_of' => $first])
            ->assertOk()->assertJsonPath('data.duplicate_of', $first);

        Sanctum::actingAs($this->reader, ['*']);
        $this->getJson("/api/v1/me/reports/{$ref}")->assertJsonPath('data.decision_note', 'Someone already reported this.')->assertJsonPath('data.can_reply', false);
        $this->post("/api/v1/me/reports/{$ref}/updates", ['message' => 'But...'], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->getJson("/api/v1/public/alerts/{$ref}")->assertNotFound();
    }

    public function test_opening_a_file_is_logged_and_nearby_reports_are_listed(): void
    {
        $ref = $this->report()['ref'];
        $this->report(['latitude' => self::LAT + 0.001]); // about 110 m away
        Sanctum::actingAs($this->verifier, ['*']);
        $detail = $this->getJson("/api/v1/admin/incidents/{$ref}")->assertOk()->json('data');
        $this->assertCount(1, $detail['nearby']);
        $this->assertSame($this->reader->email, $detail['reporter']['email']);

        $evidenceId = $detail['evidence'][0]['id'];
        $this->get("/api/v1/admin/incidents/{$ref}/evidence/{$evidenceId}")->assertOk();
        $this->assertTrue(Activity::where('event', 'evidence_viewed')->exists());
        $this->getJson("/api/v1/admin/incidents/{$ref}/evidence/{$evidenceId}/check")->assertJsonPath('intact', true);
    }

    public function test_evidence_pack_holds_original_files_and_a_matching_manifest(): void
    {
        $ref = $this->report()['ref'];
        $this->act($ref, ['action' => 'investigate'])->assertOk();

        Sanctum::actingAs($this->verifier, ['*']);
        $this->postJson("/api/v1/admin/incidents/{$ref}/handovers", ['agency' => 'PDRM IPD Melaka Tengah'])
            ->assertUnprocessable()->assertJsonValidationErrors(['officer_name', 'police_report_no']);
        $handover = $this->postJson("/api/v1/admin/incidents/{$ref}/handovers", [
            'agency' => 'PDRM IPD Melaka Tengah', 'officer_name' => 'Insp. Rahman', 'officer_id' => 'G12345', 'police_report_no' => 'MLK/RPT/2026/001',
        ])->assertCreated()->json('data');

        $this->get("/api/v1/admin/incidents/{$ref}/handovers/{$handover['id']}/download")->assertOk();
        $this->assertTrue(Activity::where('event', 'pack_downloaded')->exists());

        $zipPath = Storage::disk('local')->path(\App\Models\Civic\EvidenceHandover::first()->pack_path);
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($zipPath));
        $manifest = $zip->getFromName('manifest.txt');
        $this->assertSame($handover['manifest_sha256'], hash('sha256', $manifest));
        $evidence = IncidentEvidence::first();
        $this->assertStringContainsString("{$evidence->sha256}  evidence/01-flood.jpg", $manifest);
        $this->assertSame($evidence->sha256, hash('sha256', $zip->getFromName('evidence/01-flood.jpg')));
        $this->assertNotFalse($zip->getFromName('summary.pdf'));
        $zip->close();

        $this->getJson("/api/v1/admin/incidents/{$ref}")->assertJsonPath('data.handovers.0.police_report_no', 'MLK/RPT/2026/001');
    }

    public function test_withdrawing_deletes_files_and_old_rejected_files_are_purged(): void
    {
        $withdrawn = $this->report()['ref'];
        Sanctum::actingAs($this->reader, ['*']);
        $this->postJson("/api/v1/me/reports/{$withdrawn}/withdraw")->assertOk()->assertJsonPath('data.status', 'withdrawn');
        $this->assertNull(Incident::where('reference_no', $withdrawn)->first()->evidences()->first()->disk_path);

        $rejected = $this->report()['ref'];
        $this->act($rejected, ['action' => 'reject', 'message' => 'Not something we cover.'])->assertOk();
        $this->assertSame(0, app(IncidentService::class)->purgeExpiredEvidence());
        $this->travel(181)->days();
        $this->assertSame(1, app(IncidentService::class)->purgeExpiredEvidence());
        $evidence = Incident::where('reference_no', $rejected)->first()->evidences()->first();
        $this->assertNull($evidence->disk_path);
        $this->assertNotNull($evidence->sha256); // the record of the file stays
    }

    public function test_incident_types_in_use_cannot_be_deleted(): void
    {
        $this->report();
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $admin->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();
        Sanctum::actingAs($admin, ['*']);
        $this->deleteJson('/api/v1/admin/incident-types/flood')->assertUnprocessable()->assertJsonPath('code', 'TYPE_IN_USE');
        $this->postJson('/api/v1/admin/incident-types', ['name' => 'Landslide', 'icon' => 'mountain', 'color' => 'satay', 'default_severity' => 'high'])
            ->assertCreated()->assertJsonPath('data.slug', 'landslide');
        $this->deleteJson('/api/v1/admin/incident-types/landslide')->assertOk();
    }
}
