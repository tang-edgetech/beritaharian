"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { fileSize, saveBlob, useIncidentSummary } from "@/lib/civic";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { ApiError, type AdminIncidentDetail, type EvidenceHandover, type HandoverInput } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileArchive, Loader2, PackagePlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CopyHash } from "./copy-text";

const FALLBACK_AGENCY = "PDRM IPD Melaka Tengah";

/** Police evidence packs: a form to prepare one, and the log of packs handed over. */
export function IncidentHandover({ incident: i }: { incident: AdminIncidentDetail }) {
  // the usual police station from Settings › Reports, readable by everyone on the queue
  const summary = useIncidentSummary();
  const defaultAgency = summary.data?.default_agency || FALLBACK_AGENCY;

  return (
    <div className="incident-handover grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {i.status === "withdrawn" ? (
          <p className="panel-card text-sm">The reporter withdrew this report and its files were deleted, so no pack can be made.</p>
        ) : (
          <HandoverForm key={defaultAgency} incident={i} defaultAgency={defaultAgency} />
        )}
        <HandoverLog incident={i} />
      </div>
      <aside className="incident-handover-explainer panel-card flex flex-col gap-2 text-sm lg:sticky lg:top-20" aria-labelledby="handover-explainer-title">
        <h2 id="handover-explainer-title" className="panel-card-title">
          What is in a pack
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>summary.pdf</strong>: the report, the timeline and who handled it.
          </li>
          <li>
            <strong>The original files</strong> you tick, exactly as they arrived.
          </li>
          <li>
            <strong>manifest.txt</strong>: the SHA-256 fingerprint of every file. The police can check nothing changed with <code className="rounded bg-muted px-1">sha256sum -c manifest.txt</code>.
          </li>
        </ul>
        <p className="text-muted-foreground">The pack is a ZIP file. Its own fingerprint is recorded below, so you can prove which pack you gave. Every download is logged.</p>
      </aside>
    </div>
  );
}

function HandoverForm({ incident: i, defaultAgency }: { incident: AdminIncidentDetail; defaultAgency: string }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const kept = i.evidence.filter((e) => e.kept);
  const [values, setValues] = useState({ agency: defaultAgency, officer_name: "", officer_id: "", police_report_no: "", notes: "" });
  const [ticked, setTicked] = useState<string[]>(() => kept.map((e) => e.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.agency.trim()) found.agency = "Please write which police station or agency.";
    if (!values.officer_name.trim()) found.officer_name = "Please write the officer's name.";
    if (!values.police_report_no.trim()) found.police_report_no = "Please write the police report number.";
    if (!ticked.length && kept.length) found.evidence = "Tick at least one file.";
    setErrors(found);
    if (Object.keys(found).length) return;

    const ok = await confirm({
      title: "Prepare the evidence pack?",
      description: `${ticked.length} file${ticked.length === 1 ? "" : "s"} for ${values.officer_name.trim()} (${values.agency.trim()}), police report ${values.police_report_no.trim()}. This is recorded on the report.`,
      confirmLabel: "Prepare pack",
    });
    if (!ok) return;

    const input: HandoverInput = {
      agency: values.agency.trim(),
      officer_name: values.officer_name.trim(),
      officer_id: values.officer_id.trim() || undefined,
      police_report_no: values.police_report_no.trim(),
      notes: values.notes.trim() || undefined,
      evidence: ticked,
    };
    setBusy(true);
    try {
      const result = await api.post<{ message: string; data: EvidenceHandover }>(`admin/incidents/${i.ref}/handovers`, input);
      notify.success(result.message);
      setValues((v) => ({ ...v, officer_name: "", officer_id: "", police_report_no: "", notes: "" }));
      await queryClient.invalidateQueries({ queryKey: ["incident", i.ref] });
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k.split(".")[0], m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="handover-form panel-card flex flex-col gap-4" onSubmit={submit} noValidate>
      <div>
        <h2 className="panel-card-title">Hand evidence to the police</h2>
        <p className="panel-card-description">Fill this in when an officer asks for the files. You get a ZIP pack to give them.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="handover-agency" label="Police station or agency" error={errors.agency} className="sm:col-span-2">
          <Input id="handover-agency" value={values.agency} maxLength={150} onChange={(e) => set("agency", e.target.value)} />
        </FormField>
        <FormField id="handover-officer" label="Officer's name" error={errors.officer_name}>
          <Input id="handover-officer" value={values.officer_name} maxLength={150} onChange={(e) => set("officer_name", e.target.value)} autoComplete="off" />
        </FormField>
        <FormField id="handover-officer-id" label="Officer or badge no. (optional)" error={errors.officer_id}>
          <Input id="handover-officer-id" value={values.officer_id} maxLength={50} onChange={(e) => set("officer_id", e.target.value)} autoComplete="off" />
        </FormField>
        <FormField id="handover-report-no" label="Police report no." error={errors.police_report_no} hint="From the officer's report (Repot Polis)." className="sm:col-span-2">
          <Input id="handover-report-no" value={values.police_report_no} maxLength={100} onChange={(e) => set("police_report_no", e.target.value)} autoComplete="off" />
        </FormField>
        <FormField id="handover-notes" label="Notes (optional)" error={errors.notes} className="sm:col-span-2">
          <Textarea id="handover-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </div>
      <div className="handover-files flex flex-col gap-2" role="group" aria-labelledby="handover-files-title">
        <p id="handover-files-title" className="text-sm font-medium">
          Files to include
        </p>
        {i.evidence.length ? (
          <ul className="flex flex-col gap-1.5">
            {i.evidence.map((e) => (
              <li key={e.id}>
                <label htmlFor={`handover-file-${e.id}`} className={["handover-file flex items-center gap-2 text-sm", e.kept ? "" : "is-purged text-muted-foreground"].join(" ")}>
                  <Checkbox
                    id={`handover-file-${e.id}`}
                    checked={ticked.includes(e.id)}
                    disabled={!e.kept}
                    onCheckedChange={(on) => setTicked((list) => (on ? [...list, e.id] : list.filter((x) => x !== e.id)))}
                  />
                  <span className="min-w-0 break-all">{e.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{e.kept ? fileSize(e.size) : "deleted"}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No files. The pack holds the summary only.</p>
        )}
        {errors.evidence ? (
          <p className="field-error" role="alert">
            {errors.evidence}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={busy} className="self-end">
        {busy ? <Loader2 className="animate-spin" /> : <PackagePlus />}
        Prepare pack
      </Button>
    </form>
  );
}

function HandoverLog({ incident: i }: { incident: AdminIncidentDetail }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(h: EvidenceHandover) {
    setDownloading(h.id);
    try {
      const { blob, filename } = await api.download(`admin/incidents/${i.ref}/handovers/${h.id}/download`);
      saveBlob(blob, filename === "download" ? `${i.ref}-evidence.zip` : filename);
    } catch (error) {
      notify.error(error, "We couldn't download the pack. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="handover-log panel-card flex flex-col gap-3" aria-labelledby="handover-log-title">
      <h2 id="handover-log-title" className="panel-card-title">
        Packs handed over
      </h2>
      {i.handovers.length ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {i.handovers.map((h) => (
            <li key={h.id} className="handover-entry flex flex-col gap-2 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <FileArchive className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {h.officer_name}
                      {h.officer_id ? ` (${h.officer_id})` : ""} · {h.agency}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Police report {h.police_report_no} · {h.files} file{h.files === 1 ? "" : "s"} · {fileSize(h.pack_size)} · {formatDateTime(h.created_at)}
                      {h.exported_by ? ` by ${h.exported_by.name}` : ""}
                    </span>
                  </span>
                </div>
                {h.has_pack ? (
                  <Button size="sm" variant="outline" disabled={downloading !== null} onClick={() => download(h)}>
                    {downloading === h.id ? <Loader2 className="animate-spin" /> : <Download />}
                    Download
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Pack no longer kept</span>
                )}
              </div>
              {h.notes ? <p className="whitespace-pre-line text-muted-foreground">{h.notes}</p> : null}
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Manifest SHA-256</dt>
                <dd>
                  <CopyHash value={h.manifest_sha256} label="manifest fingerprint" />
                </dd>
                <dt className="text-muted-foreground">Pack SHA-256</dt>
                <dd>
                  <CopyHash value={h.pack_sha256} label="pack fingerprint" />
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No packs yet.</p>
      )}
    </section>
  );
}
