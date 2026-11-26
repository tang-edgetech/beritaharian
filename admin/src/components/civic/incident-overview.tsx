"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { useReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { incidentUrl, OPEN_STATUSES, useIsMe, useVerifiers } from "@/lib/civic";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AdminIncidentDetail } from "@cendol/api-client";
import { ArrowRight, CircleCheckBig, EyeOff, Loader2, Mail, MessageCircleQuestion, Phone, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { IncidentStatusBadge, IncidentTypeIcon, SeverityBadge } from "./incident-badges";
import { IncidentMap } from "./incident-map";
import { useIncidentMutation } from "./use-incident-action";

function nextStep(i: AdminIncidentDetail): string {
  switch (i.status) {
    case "new":
      return "Nobody has looked at this yet. Start checking, or ask the reporter for more detail.";
    case "needs_info":
      return i.reporter_replied
        ? "The reporter replied. Read the reply in the timeline, then carry on checking."
        : "Waiting for the reporter to answer your question. You can still check it or decide.";
    case "investigating":
      return "Being checked. When you are sure, decide: verified, could not confirm, or reject.";
    case "verified":
      return i.alert.published_at ? "Verified and shown on the site as a public alert. Close it when the situation is over." : "Verified, but not public. You can publish an alert from the Alert tab.";
    case "unconfirmed":
      return "We couldn't confirm it. The reporter has been told why. Close it, or reopen it if new proof arrives.";
    case "rejected":
      return "Rejected. The reporter has been told why. Reopen it if this was a mistake.";
    case "closed":
      return i.alert.published_at ? "Closed. The alert shows as “Resolved” on the site." : "Closed.";
    case "withdrawn":
      return "The reporter withdrew this report and its files were deleted.";
  }
}

export function IncidentOverview({ incident: i }: { incident: AdminIncidentDetail }) {
  const { can } = useAuth();
  const isMe = useIsMe();
  const confirm = useConfirm();
  const [askReason, reasonDialog] = useReasonDialog();
  const { act, busy } = useIncidentMutation(i.ref);
  const canAct = can("incidents.verify");
  const verifiers = useVerifiers(canAct);
  const isOpen = OPEN_STATUSES.includes(i.status);
  const spin = (key: string) => (busy === key ? <Loader2 className="animate-spin" /> : null);
  const statusChanges = i.timeline.filter((t) => t.to_status);

  async function askReporter() {
    const message = await askReason({
      title: "Ask the reporter",
      description: "They get this by e-mail and see it on their report. The report moves to “Waiting for reporter” until they reply.",
      label: "Your question (the reporter will see this)",
      placeholder: "e.g. Could you send a photo that shows the street sign?",
      requiredMessage: "Please write your question first.",
      confirmLabel: "Send question",
    });
    if (message) await act({ action: "request_info", message });
  }

  async function close() {
    const ok = await confirm({
      title: "Close this report?",
      description: i.alert.published_at ? "The public alert stays on the site, marked “Resolved”." : "Nothing changes on the public site.",
      confirmLabel: "Close report",
    });
    if (ok) await act({ action: "close" });
  }

  async function reopen() {
    const message = await askReason({
      title: "Reopen this report?",
      description: i.alert.published_at
        ? "It goes back to “Checking”, the decision is cleared and the public alert is taken down."
        : "It goes back to “Checking” and the decision is cleared.",
      label: "Why are you reopening it? (staff only)",
      requiredMessage: "Please write a short reason for the record.",
      confirmLabel: "Reopen",
      danger: Boolean(i.alert.published_at),
    });
    if (message) await act({ action: "reopen", message });
  }

  return (
    <div className="incident-overview grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="incident-details panel-card flex flex-col gap-3" aria-labelledby="incident-details-title">
          <h2 id="incident-details-title" className="panel-card-title">
            What was reported
          </h2>
          <p className="incident-description text-sm whitespace-pre-line">{i.description}</p>
          <p className="field-hint">The reporter&apos;s own words. Never shown on the public site.</p>
          <dl className="incident-facts grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t pt-3 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="flex items-center gap-2">
              <IncidentTypeIcon type={i.type} size="sm" />
              {i.type?.name ?? "Not set"}
            </dd>
            <dt className="text-muted-foreground">Severity</dt>
            <dd>
              <SeverityBadge severity={i.severity} />
            </dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{i.address || "Not given"}</dd>
            <dt className="text-muted-foreground">Area</dt>
            <dd>{i.area?.name ?? "Outside the known areas"}</dd>
            <dt className="text-muted-foreground">Pin</dt>
            <dd className="font-mono text-xs">
              {i.latitude.toFixed(5)}, {i.longitude.toFixed(5)}
            </dd>
            <dt className="text-muted-foreground">Happened</dt>
            <dd>{formatDateTime(i.occurred_at)}</dd>
            <dt className="text-muted-foreground">Received</dt>
            <dd>{formatDateTime(i.created_at)}</dd>
            <dt className="text-muted-foreground">Sent from</dt>
            <dd className="font-mono text-xs">{i.submitted_ip ?? "—"}</dd>
            <dt className="text-muted-foreground">Agreed to terms</dt>
            <dd>{formatDateTime(i.consented_at)}</dd>
            <dt className="text-muted-foreground">Files</dt>
            <dd>
              <Link href={incidentUrl(i.ref, "evidence")} className="underline underline-offset-2">
                {i.evidence.length} file{i.evidence.length === 1 ? "" : "s"}
              </Link>
            </dd>
          </dl>
        </section>

        {i.decided_at ? (
          <section className="incident-decision panel-card flex flex-col gap-2" aria-labelledby="incident-decision-title">
            <h2 id="incident-decision-title" className="panel-card-title">
              Decision
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <IncidentStatusBadge status={i.status} label={i.status_label} />
              by {i.decided_by?.name ?? "someone"}, {formatDateTime(i.decided_at)}
            </p>
            {i.decision_note ? <p className="incident-decision-note rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-line">{i.decision_note}</p> : null}
            {i.duplicate_of ? (
              <p className="text-sm">
                Same incident as{" "}
                <Link href={incidentUrl(i.duplicate_of)} className="font-mono font-medium underline underline-offset-2">
                  {i.duplicate_of}
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="incident-location panel-card flex flex-col gap-3" aria-labelledby="incident-location-title">
          <div>
            <h2 id="incident-location-title" className="panel-card-title">
              Map and nearby reports
            </h2>
            <p className="panel-card-description">This report in orange; other reports close by, sent within a few days, in grey. Click a grey pin to open it.</p>
          </div>
          <IncidentMap incident={i} nearby={i.nearby} className="h-72" />
          {i.nearby.length ? (
            <ul className="incident-nearby-list flex flex-col divide-y rounded-lg border text-sm">
              {i.nearby.map((n) => (
                <li key={n.ref}>
                  <Link href={incidentUrl(n.ref)} className="incident-nearby-item flex items-center gap-3 p-3 hover:bg-muted/60">
                    <IncidentTypeIcon type={n.type} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{n.title}</span>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono">{n.ref}</span> · {n.distance_m} m away · {formatRelative(n.occurred_at)}
                      </span>
                    </span>
                    <IncidentStatusBadge status={n.status} label={n.status_label} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No other reports nearby around the same time.</p>
          )}
        </section>
      </div>

      <aside className="incident-side flex flex-col gap-4 lg:sticky lg:top-20" aria-label="Status and people">
        <section className="incident-next-step panel-card flex flex-col gap-3" aria-labelledby="incident-next-title">
          <h2 id="incident-next-title" className="panel-card-title">
            Next step
          </h2>
          <IncidentStatusBadge status={i.status} label={i.status_label} />
          <p className="text-sm text-muted-foreground">{nextStep(i)}</p>
          {canAct && isMe(i.reporter) ? (
            <p className="rounded-lg bg-marigold-50 p-2 text-sm dark:bg-marigold-900/40">You sent this report yourself, so another verifier has to decide it.</p>
          ) : null}
          {canAct ? (
            <div className="incident-next-actions flex flex-col gap-2">
              {i.status === "new" || i.status === "needs_info" ? (
                <Button disabled={busy !== null} onClick={() => act({ action: "investigate" })}>
                  {spin("investigate") ?? <Search />}
                  Start checking
                </Button>
              ) : null}
              {isOpen ? (
                <Button variant="outline" disabled={busy !== null} onClick={askReporter}>
                  {spin("request_info") ?? <MessageCircleQuestion />}
                  Ask the reporter
                </Button>
              ) : null}
              {isOpen ? (
                <Button variant={i.status === "investigating" ? "default" : "outline"} asChild>
                  <Link href={incidentUrl(i.ref, "decide")}>
                    Decide
                    <ArrowRight />
                  </Link>
                </Button>
              ) : null}
              {i.status === "verified" || i.status === "unconfirmed" ? (
                <Button variant="outline" disabled={busy !== null} onClick={close}>
                  {spin("close") ?? <CircleCheckBig />}
                  Close
                </Button>
              ) : null}
              {!isOpen && i.status !== "withdrawn" ? (
                <Button variant="outline" disabled={busy !== null} onClick={reopen}>
                  {spin("reopen") ?? <RotateCcw />}
                  Reopen
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="incident-assignee panel-card flex flex-col gap-2" aria-labelledby="incident-assignee-title">
          <h2 id="incident-assignee-title" className="panel-card-title">
            Assigned to
          </h2>
          {canAct ? (
            <>
              <Label htmlFor="incident-assignee-picker" className="sr-only">
                Assigned to
              </Label>
              <Select
                value={i.assignee ? String(i.assignee.id) : "none"}
                disabled={busy !== null}
                onValueChange={(value) => act(value === "none" ? { action: "unassign" } : { action: "assign", user: Number(value) })}
              >
                <SelectTrigger id="incident-assignee-picker" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nobody</SelectItem>
                  {i.assignee && !verifiers.data?.some((v) => v.id === i.assignee?.id) ? <SelectItem value={String(i.assignee.id)}>{i.assignee.name}</SelectItem> : null}
                  {(verifiers.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                      {isMe(v) ? " (me)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isMe(i.assignee) ? (
                <Button variant="link" size="sm" className="h-auto self-start px-0" disabled={busy !== null} onClick={() => act({ action: "assign" })}>
                  Assign to me
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm">{i.assignee?.name ?? "Nobody"}</p>
          )}
        </section>

        <section className="incident-reporter panel-card flex flex-col gap-2" aria-labelledby="incident-reporter-title">
          <h2 id="incident-reporter-title" className="panel-card-title">
            Reporter
          </h2>
          {i.reporter ? (
            <>
              <p className="font-medium">
                {i.reporter.name}
              </p>
              {i.is_anonymous ? (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <EyeOff className="mt-0.5 size-3 shrink-0" aria-hidden />
                  Hidden from public: the site says “A Cendol Satay reader”. Only staff see the name.
                </p>
              ) : null}
              <ul className="flex flex-col gap-1 text-sm">
                {i.reporter.email ? (
                  <li className="flex items-center gap-2 break-all">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <a href={`mailto:${i.reporter.email}`} className="hover:underline">
                      {i.reporter.email}
                    </a>
                  </li>
                ) : null}
                {i.reporter.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <a href={`tel:${i.reporter.phone}`} className="hover:underline">
                      {i.reporter.phone}
                    </a>
                  </li>
                ) : null}
              </ul>
              <p className="text-sm text-muted-foreground">
                {i.reporter.reports_count} report{i.reporter.reports_count === 1 ? "" : "s"} sent · {i.reporter.confirmed_count} confirmed
              </p>
              <p className="field-hint">Use the timeline to message the reporter, so it is on the record.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The reporter&apos;s account was deleted.</p>
          )}
        </section>

        <section className="incident-status-history panel-card flex flex-col gap-2" aria-labelledby="incident-history-title">
          <h2 id="incident-history-title" className="panel-card-title">
            Status so far
          </h2>
          <ol className="flex flex-col gap-2 border-l pl-3 text-sm">
            {statusChanges.map((t) => (
              <li key={t.id} className="incident-history-step flex flex-col">
                <span className="font-medium">{t.to_label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(t.at)}
                  {t.by ? ` · ${t.by.name}` : ""}
                </span>
              </li>
            ))}
          </ol>
          <Button variant="link" size="sm" asChild className="h-auto self-start px-0">
            <Link href={incidentUrl(i.ref, "timeline")}>See the full timeline</Link>
          </Button>
        </section>
      </aside>
      {reasonDialog}
    </div>
  );
}
