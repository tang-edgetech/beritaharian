"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { incidentUrl, OPEN_STATUSES, SEVERITIES, SEVERITY, useIsMe } from "@/lib/civic";
import { ApiError, type AdminIncidentDetail, type IncidentActionInput, type IncidentSeverity } from "@cendol/api-client";
import { Ban, CircleCheckBig, CircleHelp, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IncidentStatusBadge } from "./incident-badges";
import { useIncidentMutation } from "./use-incident-action";

type Outcome = "verify" | "unconfirm" | "reject";

const OUTCOMES: { value: Outcome; label: string; hint: string; icon: typeof Ban }[] = [
  { value: "verify", label: "Verified", hint: "It happened as reported. You can publish a public alert.", icon: CircleCheckBig },
  { value: "unconfirm", label: "Could not confirm", hint: "It may be true, but we can't prove it. Nothing goes public.", icon: CircleHelp },
  { value: "reject", label: "Reject", hint: "Not a real incident, a duplicate, or breaks the rules.", icon: Ban },
];

/** The full-page decision form: outcome, checklist, severity and, for verified reports, the public alert. */
export function IncidentDecide({ incident: i }: { incident: AdminIncidentDetail }) {
  const isMe = useIsMe();
  const confirm = useConfirm();
  const router = useRouter();
  const { run, busy } = useIncidentMutation(i.ref);
  const [outcome, setOutcome] = useState<Outcome>("verify");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => ({ ...i.checklist }));
  const [severity, setSeverity] = useState<IncidentSeverity>(i.severity);
  const [publish, setPublish] = useState(false);
  const [title, setTitle] = useState(i.alert.title ?? "");
  const [summary, setSummary] = useState(i.alert.summary ?? "");
  const [place, setPlace] = useState(i.alert.place ?? i.address ?? "");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!OPEN_STATUSES.includes(i.status)) {
    return (
      <section className="incident-decide-closed panel-card flex flex-col items-start gap-3">
        <p className="flex flex-wrap items-center gap-2">
          This report is already decided: <IncidentStatusBadge status={i.status} label={i.status_label} />
        </p>
        <p className="text-sm text-muted-foreground">To change the decision, reopen it from the overview first.</p>
        <Button variant="outline" asChild>
          <Link href={incidentUrl(i.ref)}>Go to the overview</Link>
        </Button>
      </section>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (outcome !== "verify" && !reason.trim()) found.message = "Please write a short reason. The reporter will see it.";
    if (outcome === "verify" && publish) {
      if (!title.trim()) found.public_title = "Please write the alert title.";
      if (!summary.trim()) found.public_summary = "Please write what happened, for the public.";
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    const words = {
      verify: publish
        ? { title: "Verify and publish the alert?", description: "The alert goes on the public site straight away and the reporter is told their report was confirmed.", confirmLabel: "Verify and publish" }
        : { title: "Mark as verified?", description: "The report stays private. You can publish an alert later from the Alert tab.", confirmLabel: "Verify" },
      unconfirm: { title: "Mark as “could not confirm”?", description: "The reporter gets your reason by e-mail. Nothing goes public.", confirmLabel: "Send and close" },
      reject: { title: "Reject this report?", description: "The reporter gets your reason by e-mail. Its files are deleted after the retention period.", confirmLabel: "Reject", danger: true },
    }[outcome];
    if (!(await confirm(words))) return;

    const input: IncidentActionInput =
      outcome === "verify"
        ? { action: "verify", severity, checklist, note: note.trim() || undefined, publish_alert: publish, public_title: title.trim(), public_summary: summary.trim(), public_address: place.trim() }
        : outcome === "unconfirm"
          ? { action: "unconfirm", message: reason.trim(), checklist }
          : { action: "reject", message: reason.trim(), duplicate_of: duplicateOf.trim().toUpperCase() || undefined };

    const saved = await run(outcome, () => api.post(`admin/incidents/${i.ref}/action`, input), (error) => {
      if (error instanceof ApiError) {
        if (error.code === "ALERT_TEXT_NEEDED") setErrors({ public_title: error.message });
        else if (error.code === "DUPLICATE_NOT_FOUND") setErrors({ duplicate_of: error.message });
        else setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      }
    });
    if (saved) router.push(incidentUrl(i.ref));
  }

  return (
    <form className="incident-decide flex max-w-3xl flex-col gap-4" onSubmit={submit} noValidate>
      {isMe(i.reporter) ? <p className="incident-own-report rounded-lg bg-marigold-50 p-3 text-sm dark:bg-marigold-900/40">This looks like your own report. Another verifier has to decide it.</p> : null}
      <section className="incident-outcome panel-card flex flex-col gap-3">
        <h2 className="panel-card-title">Outcome</h2>
        <div className="incident-outcome-options grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Outcome">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={outcome === o.value}
              onClick={() => setOutcome(o.value)}
              className={[
                "incident-outcome-option flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                outcome === o.value ? "is-selected border-foreground bg-muted ring-2 ring-ring/30" : "hover:bg-muted/60",
              ].join(" ")}
            >
              <span className="flex items-center gap-2 font-medium">
                <o.icon className="size-4" aria-hidden />
                {o.label}
              </span>
              <span className="text-xs text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {outcome !== "reject" ? (
        <section className="incident-checklist panel-card flex flex-col gap-2">
          <h2 className="panel-card-title">Checklist</h2>
          <p className="panel-card-description">Tick what you checked. It is saved with the decision for the record.</p>
          {i.checklist_items.map((item) => (
            <label key={item.key} htmlFor={`check-${item.key}`} className="incident-checklist-item flex items-start gap-2 text-sm">
              <Checkbox
                id={`check-${item.key}`}
                checked={Boolean(checklist[item.key])}
                onCheckedChange={(on) => setChecklist((c) => ({ ...c, [item.key]: on === true }))}
                className="mt-0.5"
              />
              {item.label}
            </label>
          ))}
        </section>
      ) : null}

      {outcome === "verify" ? (
        <>
          <section className="incident-severity panel-card flex flex-col gap-2">
            <h2 className="panel-card-title">Severity</h2>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Severity">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={severity === s}
                  onClick={() => setSeverity(s)}
                  className={[
                    "incident-severity-option flex flex-col items-start rounded-lg border p-2.5 text-left",
                    severity === s ? "is-selected border-foreground bg-muted ring-2 ring-ring/30" : "hover:bg-muted/60",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium">{SEVERITY[s].label}</span>
                  <span className="text-xs text-muted-foreground">{SEVERITY[s].hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="incident-publish panel-card flex flex-col gap-4" aria-labelledby="incident-publish-title">
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="incident-publish-switch" className="flex flex-col items-start gap-0.5 font-normal">
                <span id="incident-publish-title" className="panel-card-title">
                  Publish as a public alert
                </span>
                <span className="text-xs text-muted-foreground">Shown on the site and the alerts map straight away. You can edit or take it down later.</span>
              </Label>
              <Switch id="incident-publish-switch" checked={publish} onCheckedChange={setPublish} />
            </div>
            <div className="incident-publish-rules flex gap-2 rounded-lg bg-marigold-50 p-3 text-sm dark:bg-marigold-900/40">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Write the alert in your own words. The reporter&apos;s words are never shown publicly. Describe the event, not who is to blame: no names, number plates or
                accusations.
              </p>
            </div>
            {publish ? (
              <div className="grid gap-4">
                <FormField id="alert-title" label="Public title" error={errors.public_title} hint="Short and factual, e.g. “Flooding on Jalan Hang Jebat”.">
                  <Input id="alert-title" value={title} maxLength={150} onChange={(e) => {
                      setTitle(e.target.value);
                      setErrors((e) => ({ ...e, public_title: "" }));
                    }} aria-invalid={Boolean(errors.public_title)} />
                </FormField>
                <FormField id="alert-summary" label="What people should know" error={errors.public_summary} hint="What happened, where, and what to do. Up to a few sentences.">
                  <Textarea id="alert-summary" rows={4} value={summary} maxLength={3000} onChange={(e) => {
                      setSummary(e.target.value);
                      setErrors((e) => ({ ...e, public_summary: "" }));
                    }} aria-invalid={Boolean(errors.public_summary)} />
                </FormField>
                <FormField id="alert-place" label="Place name (optional)" error={errors.public_address} hint="A street or landmark, e.g. “Jalan Hang Jebat”. Not a house number.">
                  <Input id="alert-place" value={place} maxLength={200} onChange={(e) => setPlace(e.target.value)} />
                </FormField>
              </div>
            ) : null}
          </section>

          <FormField id="decide-note" label="Note for the team (optional)" hint="Only staff see this." className="panel-card">
            <Textarea id="decide-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </>
      ) : (
        <section className="incident-reason panel-card flex flex-col gap-4">
          <FormField id="decide-reason" label="Reason" error={errors.message} hint="The reporter will see this, and gets it by e-mail. Keep it polite and clear.">
            <Textarea
              id="decide-reason"
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((e) => ({ ...e, message: "" }));
              }}
              aria-invalid={Boolean(errors.message)}
              placeholder={outcome === "unconfirm" ? "e.g. We couldn't find anyone else who saw this, and the photo doesn't show the place." : "e.g. This was already reported and is on the alerts map."}
            />
          </FormField>
          {outcome === "reject" ? (
            <div className="flex flex-col gap-2">
              <FormField id="decide-duplicate" label="Duplicate of (optional)" error={errors.duplicate_of} hint="Another report's reference, if this is the same incident.">
                <Input id="decide-duplicate" value={duplicateOf} placeholder="MLK-2026-000001" className="font-mono" onChange={(e) => setDuplicateOf(e.target.value)} />
              </FormField>
              {i.nearby.length ? (
                <div className="incident-duplicate-picks flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Nearby:</span>
                  {i.nearby.map((n) => (
                    <Button
                      key={n.ref}
                      type="button"
                      size="sm"
                      variant={duplicateOf === n.ref ? "default" : "outline"}
                      title={`${n.title} · ${n.status_label} · ${n.distance_m} m away`}
                      onClick={() => setDuplicateOf(duplicateOf === n.ref ? "" : n.ref)}
                    >
                      <span className="font-mono">{n.ref}</span>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      <div className="incident-decide-actions flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={incidentUrl(i.ref)}>Cancel</Link>
        </Button>
        <Button type="submit" variant={outcome === "reject" ? "destructive" : "default"} disabled={busy !== null}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {outcome === "verify" ? (publish ? "Verify and publish" : "Verify") : outcome === "unconfirm" ? "Mark as could not confirm" : "Reject report"}
        </Button>
      </div>
    </form>
  );
}
