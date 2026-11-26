"use client";

import { errorMessage, fieldErrors, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { readerApi, requireReader } from "@/lib/auth";
import { alertHref, fileSize, reportStatusTone, reportStep } from "@/lib/alert-links";
import type { ReportLimits } from "@/lib/alerts";
import { formatDateTime } from "@/lib/format";
import type { MyReportDetail, MyReportFile, MyReportTimelineItem } from "@cendol/api-client";
import { MapView } from "@cendol/map";
import { ArrowLeft, Camera, Check, ExternalLink, EyeOff, FileText, Film, Info, MapPin, MessageCircleWarning, Mic, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { TextAreaField } from "../places/form-bits";
import { ConfirmDialog } from "../site/confirm-dialog";
import { FlashMessage } from "../site/flash-message";
import { IncidentTypeChip } from "./alert-bits";
import { EvidencePicker, filesError } from "./evidence-picker";

const KIND_ICON = { image: Camera, video: Film, audio: Mic, document: FileText } as const;
const STEPS = ["Sent", "Being checked", "Decided"];

/** One of the reader's own reports: where it stands, what they sent, the conversation with the team. */
export function MyReportView({ reference, limits }: { reference: string; limits: ReportLimits }) {
  const router = useRouter();
  const [report, setReport] = useState<MyReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const path = `/account/reports/${encodeURIComponent(reference)}`;

  const load = useCallback(
    (signal?: AbortSignal) =>
      readerApi
        .get<{ data: MyReportDetail }>(`me/reports/${encodeURIComponent(reference)}`, undefined, signal)
        .then((r) => {
          setReport(r.data);
          setError(null);
        })
        .catch((e) => {
          if (!signal?.aborted) setError(errorMessage(e));
        }),
    [reference],
  );

  useEffect(() => {
    if (requireReader(router, path)) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [router, path, load]);

  async function withdraw() {
    setWithdrawing(true);
    try {
      const r = await readerApi.post<{ message: string; data: MyReportDetail }>(`me/reports/${encodeURIComponent(reference)}/withdraw`);
      setReport(r.data);
      setNotice(r.message);
      setError(null);
      setConfirming(false);
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="my-report-page site-container flex max-w-3xl flex-col gap-5 py-6">
      <Link href="/account/reports" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Your reports
      </Link>
      <FlashMessage />
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}

      {!report ? (
        error ? null : (
          <div className="flex flex-col gap-3" aria-busy>
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-santan-200 dark:bg-santan-800" />
            <div className="h-40 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
          </div>
        )
      ) : (
        <>
          <header className="my-report-header flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`my-report-status inline-flex h-7 items-center rounded-full px-3 text-sm font-bold ${reportStatusTone(report.status)}`}>{report.status_label}</span>
              <IncidentTypeChip type={report.type} />
              <span className="text-xs text-santan-500">{report.ref}</span>
            </div>
            <h1 className="page-heading">{report.title}</h1>
          </header>

          <Progress report={report} />

          {report.needs_reply ? (
            <p className="my-report-needs-reply flex items-start gap-2 rounded-xl bg-marigold-100 px-4 py-3 text-sm font-semibold text-marigold-900 dark:bg-marigold-900 dark:text-marigold-100" role="status">
              <MessageCircleWarning className="mt-0.5 size-5 shrink-0" aria-hidden />
              Our team needs a little more from you. Please read their message below and reply.
            </p>
          ) : null}

          {report.decision_note ? (
            <div className="my-report-decision flex items-start gap-2 rounded-xl bg-santan-100 px-4 py-3 text-sm dark:bg-santan-800">
              <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                <span className="font-bold">Why: </span>
                {report.decision_note}
              </p>
            </div>
          ) : null}

          {report.is_alert || report.duplicate_of ? (
            <Link
              href={alertHref(report.is_alert ? report.ref : (report.duplicate_of as string))}
              className="my-report-alert-link inline-flex items-center justify-between gap-2 rounded-xl bg-pandan-50 px-4 py-3 text-sm font-bold text-pandan-900 hover:bg-pandan-100 dark:bg-pandan-950 dark:text-pandan-100"
            >
              <span className="inline-flex items-center gap-2">
                <Check className="size-5" aria-hidden />
                {report.is_alert ? "Your report is now a public alert. See it" : "Someone already reported this. See the public alert"}
              </span>
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : null}

          <Timeline items={report.timeline} />

          {report.can_reply ? <ReplyBox key={report.updated_at} report={report} limits={limits} onSent={(r, m) => { setReport(r); setNotice(m); }} /> : null}

          <WhatYouSent report={report} />

          {report.can_withdraw ? (
            <div className="my-report-withdraw flex flex-col gap-2 border-t border-santan-200 pt-4 dark:border-santan-800">
              <p className="text-sm text-santan-600 dark:text-santan-300">Sent this by mistake, or it sorted itself out?</p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                title="Withdraw this report"
                className="inline-flex h-10 items-center gap-1.5 self-start rounded-full border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                <Undo2 className="size-4" aria-hidden />
                Withdraw report
              </button>
            </div>
          ) : null}

          <ConfirmDialog open={confirming} title="Withdraw this report?" confirmLabel="Yes, withdraw it" cancelLabel="Keep it" busy={withdrawing} onConfirm={withdraw} onCancel={() => setConfirming(false)}>
            <p>Our team will stop checking it, and the files you sent will be deleted.</p>
            <p>This can&apos;t be undone. If it happens again, you can send a new report.</p>
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}

function Progress({ report }: { report: MyReportDetail }) {
  const step = reportStep(report.status);
  return (
    <ol className="report-progress grid grid-cols-3 gap-2" aria-label="Where your report is">
      {STEPS.map((label, i) => {
        const done = i < step || (i === step && step === 2);
        const current = i === step;
        return (
          <li key={label} className={`report-progress-step flex flex-col gap-1.5 ${done ? "is-done" : ""} ${current ? "is-current" : ""}`} aria-current={current ? "step" : undefined}>
            <span className={`h-2 rounded-full ${i <= step ? "bg-pandan-600" : "bg-santan-200 dark:bg-santan-800"}`} aria-hidden />
            <span className={`text-xs font-semibold ${current ? "text-gula-900 dark:text-coconut" : "text-santan-500"}`}>{i === 2 && step === 2 ? report.status_label : label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Timeline({ items }: { items: MyReportTimelineItem[] }) {
  if (!items.length) return null;
  return (
    <section className="report-timeline flex flex-col gap-3" aria-label="What's happened so far">
      <h2 className="font-display text-xl font-black text-gula-900 dark:text-coconut">
        What&apos;s happened so far
      </h2>
      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <TimelineItem key={item.id} item={item} />
        ))}
      </ol>
    </section>
  );
}

function TimelineItem({ item }: { item: MyReportTimelineItem }) {
  const when = <time className="text-xs text-santan-500" dateTime={item.at}>{formatDateTime(item.at)}</time>;
  const files = item.files.length ? (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {item.files.map((name, i) => (
        <li key={`${name}-${i}`} className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-santan-200/70 px-2 py-0.5 text-xs dark:bg-santan-700">
          <FileText className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{name}</span>
        </li>
      ))}
    </ul>
  ) : null;

  // status changes and other events: a small line; messages: a speech bubble
  if (item.kind === "message" || item.kind === "reply" || item.kind === "note") {
    const mine = item.from === "you";
    return (
      <li className={`timeline-message flex flex-col gap-1 ${mine ? "is-mine items-end" : "is-team items-start"}`}>
        <span className="text-xs font-bold text-santan-600 dark:text-santan-300">{mine ? "You" : "Cendol Satay team"}</span>
        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${mine ? "rounded-br-sm bg-pandan-600 text-white" : "rounded-bl-sm bg-white ring-1 ring-santan-200 dark:bg-santan-900 dark:ring-santan-800"}`}>
          {item.body ?? (item.files.length ? "Added files" : "")}
          {files}
        </div>
        {when}
      </li>
    );
  }

  const text =
    item.kind === "submitted"
      ? "You sent this report."
      : item.kind === "status"
        ? `Status: ${item.status ?? "updated"}`
        : item.kind === "evidence"
          ? item.from === "you" ? "You added files." : "Files were added."
          : item.kind === "alert"
            ? "Our team posted a public alert."
            : "Updated.";
  return (
    <li className={`timeline-event is-${item.kind} flex flex-col items-center gap-0.5 text-center`}>
      <span className="rounded-full bg-santan-100 px-3 py-1 text-xs font-semibold text-santan-700 dark:bg-santan-800 dark:text-santan-200">{text}</span>
      {item.body && item.kind !== "submitted" ? <p className="text-sm">{item.body}</p> : null}
      {files}
      {when}
    </li>
  );
}

function ReplyBox({ report, limits, onSent }: { report: MyReportDetail; limits: ReportLimits; onSent: (report: MyReportDetail, message: string) => void }) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `reply-${report.ref}`;

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() && !files.length) {
      setProblem("Please write a reply or add a file.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const fields: Record<string, string | Blob | null> = { message: message.trim() || null };
    files.forEach((f, i) => (fields[`files[${i}]`] = f));
    try {
      const r = await readerApi.upload<{ message: string; data: MyReportDetail }>(`me/reports/${encodeURIComponent(report.ref)}/updates`, fields);
      onSent(r.data, r.message);
    } catch (e) {
      setErrors(fieldErrors(e));
      setProblem(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form
      className={`reply-box flex flex-col gap-4 rounded-card border bg-white p-5 dark:bg-santan-900 ${report.needs_reply ? "has-reply-needed border-marigold-400 ring-2 ring-marigold-200 dark:ring-marigold-900" : "border-santan-200 dark:border-santan-800"}`}
      onSubmit={send}
      noValidate
    >
      <h2 className="font-display text-xl font-black text-gula-900 dark:text-coconut">{report.needs_reply ? "Reply to our team" : "Add more to your report"}</h2>
      {problem ? <FormMessage>{problem}</FormMessage> : null}
      <TextAreaField id={`${id}-message`} label="Your message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} rows={4} error={errors.message} hint="Only our team sees this." />
      <EvidencePicker label="More photos, videos, voice notes or PDF (optional)" files={files} onChange={setFiles} maxFiles={limits.maxFiles} maxFileMb={limits.maxFileMb} error={filesError(errors)} />
      <SubmitButton busy={busy}>{busy ? "Sending…" : "Send"}</SubmitButton>
    </form>
  );
}

function WhatYouSent({ report }: { report: MyReportDetail }) {
  return (
    <section className="what-you-sent flex flex-col gap-4 rounded-card border border-santan-200 bg-white p-5 dark:border-santan-800 dark:bg-santan-900" aria-label="What you sent">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-xl font-black text-gula-900 dark:text-coconut">
          What you sent
        </h2>
        <p className="text-xs text-santan-500">Only you and our verifiers can see this.</p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-santan-500">Happened</dt>
          <dd className="font-semibold">{formatDateTime(report.occurred_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-santan-500">Sent</dt>
          <dd className="font-semibold">{formatDateTime(report.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-santan-500">Your name on a public alert</dt>
          <dd className="inline-flex items-center gap-1 font-semibold">
            {report.is_anonymous ? (
              <>
                <EyeOff className="size-4" aria-hidden />
                Hidden (“A Cendol Satay reader”)
              </>
            ) : (
              "Shown"
            )}
          </dd>
        </div>
        {report.area ? (
          <div>
            <dt className="text-xs font-semibold text-santan-500">Area</dt>
            <dd className="font-semibold">{report.area.name}</dd>
          </div>
        ) : null}
      </dl>
      <p className="my-report-description text-sm whitespace-pre-line text-santan-800 dark:text-santan-100">{report.description}</p>
      <div className="flex flex-col gap-2">
        <MapView
          label="Map showing where you dropped the pin"
          pins={[{ id: report.ref, latitude: report.latitude, longitude: report.longitude, label: report.title, tone: "satay" }]}
          center={{ latitude: report.latitude, longitude: report.longitude }}
          zoom={16}
          className="my-report-map h-48 rounded-xl border border-santan-200 dark:border-santan-800"
        />
        {report.address ? (
          <p className="flex items-center gap-1 text-sm text-santan-600 dark:text-santan-300">
            <MapPin className="size-4 shrink-0" aria-hidden />
            Near {report.address}
          </p>
        ) : null}
      </div>
      {report.files.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Your files</h3>
          <ul className="my-report-files flex flex-col gap-1.5">
            {report.files.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FileRow({ file }: { file: MyReportFile }) {
  const Icon = KIND_ICON[file.kind] ?? FileText;
  return (
    <li className={`my-report-file flex items-center gap-2 text-sm ${file.kept ? "" : "is-deleted text-santan-500"}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={`min-w-0 flex-1 truncate ${file.kept ? "" : "line-through"}`} title={file.name}>
        {file.name}
      </span>
      <span className="shrink-0 text-xs text-santan-500">{file.kept ? fileSize(file.size) : "Deleted"}</span>
    </li>
  );
}
