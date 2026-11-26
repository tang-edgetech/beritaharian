"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { AdminIncidentDetail, IncidentTimelineItem, IncidentUpdateKind } from "@cendol/api-client";
import {
  ArrowRightLeft,
  Eye,
  FileUp,
  Inbox,
  Loader2,
  Mail,
  MessageCircleReply,
  NotebookPen,
  PackageCheck,
  Radio,
  Send,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useIncidentMutation } from "./use-incident-action";

const KIND: Record<IncidentUpdateKind, { label: string; icon: LucideIcon }> = {
  submitted: { label: "Report received", icon: Inbox },
  status: { label: "Status changed", icon: ArrowRightLeft },
  note: { label: "Internal note", icon: NotebookPen },
  message: { label: "Message to the reporter", icon: Mail },
  reply: { label: "Reporter replied", icon: MessageCircleReply },
  evidence: { label: "Files added", icon: FileUp },
  assigned: { label: "Assignment", icon: UserCheck },
  alert: { label: "Public alert", icon: Radio },
  handover: { label: "Handed to the police", icon: PackageCheck },
};

function TimelineEntry({ item }: { item: IncidentTimelineItem }) {
  const kind = KIND[item.kind] ?? { label: item.kind, icon: NotebookPen };
  const fromReporter = item.by?.is_reporter || item.kind === "reply";
  return (
    <li className={["timeline-entry relative flex gap-3 pb-5", `is-${item.kind}`].join(" ")}>
      <span
        className={[
          "timeline-entry-icon z-10 grid size-8 shrink-0 place-items-center rounded-full border",
          fromReporter ? "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-200" : item.kind === "note" ? "bg-muted" : "bg-card",
        ].join(" ")}
        aria-hidden
      >
        <kind.icon className="size-4" />
      </span>
      <div className="timeline-entry-body flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{item.kind === "status" && item.to_label ? `Now: ${item.to_label}` : kind.label}</span>
          <span className="text-xs text-muted-foreground">
            {item.by ? item.by.name : "System"} · {formatDateTime(item.at)}
          </span>
          {item.visible_to_reporter ? (
            <span className="timeline-visible inline-flex items-center gap-1 rounded-full bg-pandan-50 px-2 text-xs text-pandan-800 dark:bg-pandan-900/60 dark:text-pandan-200">
              <Eye className="size-3" aria-hidden />
              Reporter can see this
            </span>
          ) : null}
        </p>
        {item.body ? (
          <p className={["timeline-entry-text text-sm whitespace-pre-line", item.kind === "message" || item.kind === "reply" || item.kind === "note" ? "rounded-lg bg-muted/60 p-3" : "text-muted-foreground"].join(" ")}>
            {item.body}
          </p>
        ) : null}
        {item.files.length ? (
          <ul className="timeline-entry-files flex flex-wrap gap-1.5 text-xs">
            {item.files.map((name) => (
              <li key={name} className="rounded border px-2 py-0.5 break-all">
                {name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export function IncidentTimeline({ incident: i }: { incident: AdminIncidentDetail }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const { run, busy } = useIncidentMutation(i.ref);
  const [body, setBody] = useState("");
  const [toReporter, setToReporter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError(toReporter ? "Please write your message first." : "Please write your note first.");
      return;
    }
    if (toReporter && !(await confirm({ title: "Send this to the reporter?", description: "They see it on their report and get it by e-mail.", confirmLabel: "Send" }))) return;
    const saved = await run("note", () => api.post(`admin/incidents/${i.ref}/notes`, { body: body.trim(), to_reporter: toReporter }));
    if (saved) setBody("");
  }

  const items = [...i.timeline].reverse();

  return (
    <div className="incident-timeline grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="incident-timeline-list panel-card" aria-labelledby="incident-timeline-title">
        <h2 id="incident-timeline-title" className="panel-card-title mb-4">
          Everything that happened, newest first
        </h2>
        <ol className="timeline relative before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
          {items.map((item) => (
            <TimelineEntry key={item.id} item={item} />
          ))}
        </ol>
      </section>

      {can("incidents.verify") ? (
        <form className="incident-composer panel-card flex flex-col gap-3 lg:sticky lg:top-20" onSubmit={submit} noValidate>
          <h2 className="panel-card-title">Add to the timeline</h2>
          <div className="incident-composer-mode grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Who sees it">
            {[
              { value: false, label: "Internal note", icon: NotebookPen },
              { value: true, label: "Message reporter", icon: Mail },
            ].map((mode) => (
              <button
                key={mode.label}
                type="button"
                role="radio"
                aria-checked={toReporter === mode.value}
                onClick={() => setToReporter(mode.value)}
                className={[
                  "incident-composer-mode-option inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium",
                  toReporter === mode.value ? "is-selected bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <mode.icon className="size-4" aria-hidden />
                {mode.label}
              </button>
            ))}
          </div>
          <p className={["text-xs", toReporter ? "rounded-md bg-marigold-50 p-2 text-foreground dark:bg-marigold-900/40" : "text-muted-foreground"].join(" ")}>
            {toReporter ? "The reporter sees this on their report and gets it by e-mail. Keep it polite and plain." : "Only staff see notes."}
          </p>
          <Label htmlFor="incident-composer-body" className="sr-only">
            {toReporter ? "Message to the reporter" : "Internal note"}
          </Label>
          <Textarea
            id="incident-composer-body"
            rows={5}
            value={body}
            maxLength={3000}
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            placeholder={toReporter ? "e.g. Thank you. We are checking with the council." : "e.g. Called the council hotline, they know about it."}
          />
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy !== null} className="self-end">
            {busy ? <Loader2 className="animate-spin" /> : toReporter ? <Send /> : <NotebookPen />}
            {toReporter ? "Send to reporter" : "Add note"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
