"use client";

import { useConfirm, type ConfirmOptions } from "@/components/confirm-dialog";
import { ReviewStatusBadge, Stars } from "@/components/directory/directory-badges";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { openForPrint } from "@/lib/billing";
import { FLAG_LABEL, PROOF_LABEL, publicPlaceUrl, SUB_RATING_LABEL } from "@/lib/directory";
import { formatDate, formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { AdminReview, SubRatingKey } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, ExternalLink, EyeOff, FlagOff, Loader2, MapPinCheck, Receipt, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

type Action = "approve" | "return" | "remove" | "restore" | "dismiss_reports";

function nextStep(r: AdminReview): string {
  if (r.deleted_at) return "The writer deleted this review.";
  switch (r.status) {
    case "pending":
      return "Look at the receipt: right place, and a date close to the visit? Then approve, or send it back with a reason.";
    case "held":
      return "The automatic checks held this back. Read it: approve if it's fair, or send it back with a reason.";
    case "visible":
      return r.open_reports ? "Shown on the site, and reported. Read the reports, then close them or take the review down." : "Shown on the site.";
    case "returned":
      return "Sent back to the writer. They can delete it and write a new one.";
    case "removed":
      return "Taken down. You can put it back if it was a mistake.";
  }
}

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const query = useQuery({
    queryKey: ["directory-review", id],
    queryFn: () => api.get<{ data: AdminReview }>(`admin/directory/reviews/${id}`).then((r) => r.data),
  });
  const r = query.data;

  async function run(action: Action, options: ConfirmOptions, needsNote = false) {
    if (!r) return;
    if (needsNote && !note.trim()) {
      setNoteError("Please write a short reason. The writer will see it.");
      return;
    }
    setNoteError(null);
    if (!(await confirm(options))) return;
    setBusy(action);
    try {
      const result = await api.post<{ message: string; data: AdminReview }>(`admin/directory/reviews/${r.id}/moderate`, { action, note: note.trim() || null });
      notify.success(result.message);
      queryClient.setQueryData(["directory-review", r.id], result.data);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      await queryClient.invalidateQueries({ queryKey: ["directory-summary"] });
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  const spin = (action: Action) => (busy === action ? <Loader2 className="animate-spin" /> : null);
  const waiting = r && !r.deleted_at && (r.status === "pending" || r.status === "held");
  const subRatings = r ? (Object.entries(r.sub_ratings) as [SubRatingKey, number][]) : [];

  return (
    <>
      <PageHeader
        back="/reviews"
        backLabel="Reviews"
        title={r ? `Review of ${r.place?.name ?? "a deleted place"}` : <Skeleton className="h-8 w-72" />}
        description={r ? <span className="flex flex-wrap items-center gap-2"><ReviewStatusBadge status={r.status} deleted={Boolean(r.deleted_at)} /> Written {formatDateTime(r.created_at)}</span> : null}
      />
      {query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : r ? (
        <div className="review-detail grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <article className="review-body panel-card flex flex-col gap-3" aria-labelledby="review-heading">
              <div className="flex flex-wrap items-center gap-3">
                <Stars rating={r.rating} size="md" />
                {r.is_verified_visit ? <StatusBadge tone="good">Verified visit</StatusBadge> : null}
              </div>
              <h2 id="review-heading" className="font-heading text-lg font-bold">
                {r.title || <span className="sr-only">Review text</span>}
              </h2>
              <p className="review-text whitespace-pre-line">{r.body}</p>
              {subRatings.length ? (
                <dl className="review-sub-ratings flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {subRatings.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <dt className="text-muted-foreground">{SUB_RATING_LABEL[key] ?? key}</dt>
                      <dd>
                        <Stars rating={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {r.photos.length ? (
                <ul className="review-photos flex flex-wrap gap-2" aria-label="Photos with the review">
                  {r.photos.map((p) => (
                    <li key={p.id}>
                      <a href={p.large ?? p.card ?? "#"} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API's media folder */}
                        <img src={p.thumb ?? ""} alt={p.alt || "Photo from the review"} className="h-24 w-32 rounded-md border object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-t pt-3 text-sm">
                <dt className="text-muted-foreground">Writer</dt>
                <dd>
                  {r.writer ? (
                    <Link href={`/users/${r.writer.id}`} className="hover:underline">
                      {r.writer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {r.is_anonymous ? <span className="text-muted-foreground"> · shown as “{r.author_name}”</span> : null}
                </dd>
                <dt className="text-muted-foreground">Visited</dt>
                <dd>{formatDate(r.visited_on)}</dd>
                {r.branch_label ? (
                  <>
                    <dt className="text-muted-foreground">Branch</dt>
                    <dd>{r.branch_label}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Place</dt>
                <dd>
                  {r.place ? (
                    <Link href={`/directory/businesses/${r.place.id}/details`} className="hover:underline">
                      {r.place.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt className="text-muted-foreground">Helpful</dt>
                <dd>{r.helpful_count}</dd>
              </dl>
              {r.reply ? (
                <div className="review-reply rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="font-medium">Reply from the owner · {formatDate(r.reply.created_at)}</p>
                  <p className="mt-1 whitespace-pre-line">{r.reply.body}</p>
                </div>
              ) : null}
            </article>

            <section className="review-proof panel-card flex flex-col gap-3" aria-labelledby="review-proof-title">
              <h2 id="review-proof-title" className="panel-card-title">
                Proof of visit
              </h2>
              {r.proof ? (
                <>
                  <p className="flex items-center gap-2 text-sm">
                    {r.proof.kind === "receipt" ? <Receipt className="size-4" /> : <MapPinCheck className="size-4" />}
                    {PROOF_LABEL[r.proof.kind]}
                    <StatusBadge tone={r.proof.status === "confirmed" ? "good" : r.proof.status === "rejected" ? "danger" : "warning"}>
                      {r.proof.status === "confirmed" ? "Checked" : r.proof.status === "rejected" ? "Not accepted" : "Not checked yet"}
                    </StatusBadge>
                  </p>
                  {r.proof.kind === "checkin" ? (
                    <p className="text-sm text-muted-foreground">
                      Checked in {r.proof.distance_m ?? "?"} m from the branch{r.proof.verified_at ? `, ${formatDateTime(r.proof.verified_at)}` : ""}. Check-ins within range are confirmed automatically.
                    </p>
                  ) : r.proof.has_file ? (
                    <Button variant="outline" className="self-start" onClick={() => openForPrint(`admin/directory/reviews/${r.id}/receipt`)}>
                      <Receipt />
                      Open the receipt photo
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">The receipt photo is no longer kept. Receipts are deleted 90 days after the check, or when a review is sent back.</p>
                  )}
                  {r.proof.kind === "receipt" ? <p className="field-hint">Receipts are private: never shown on the site or to the owner.</p> : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No proof was attached (sample review).</p>
              )}
            </section>

            {r.flags.length ? (
              <section className="review-flags panel-card flex flex-col gap-2" aria-labelledby="review-flags-title">
                <h2 id="review-flags-title" className="panel-card-title">
                  Why it was held
                </h2>
                <ul className="list-disc pl-5 text-sm">
                  {r.flags.map((f) => (
                    <li key={f}>{FLAG_LABEL[f] ?? f}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {r.reports?.length ? (
              <section className="review-reports panel-card flex flex-col gap-3" aria-labelledby="review-reports-title">
                <h2 id="review-reports-title" className="panel-card-title">
                  Reports ({r.reports.length})
                </h2>
                <ul className="flex flex-col divide-y rounded-lg border text-sm">
                  {r.reports.map((rep) => (
                    <li key={rep.id} className="flex flex-col gap-1 p-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{rep.reason_label}</span>
                        <StatusBadge tone={rep.status === "open" ? "warning" : "neutral"}>{rep.status === "open" ? "Open" : "Closed"}</StatusBadge>
                        {rep.is_manager ? <StatusBadge tone="neutral">From the owner</StatusBadge> : null}
                      </span>
                      {rep.note ? <span className="whitespace-pre-line">{rep.note}</span> : null}
                      <span className="text-xs text-muted-foreground">
                        {rep.by?.name ?? "Someone"} · {formatDateTime(rep.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="review-moderation panel-card flex flex-col gap-4 lg:sticky lg:top-20" aria-label="Moderation">
            <div className="flex flex-col gap-2">
              <h2 className="panel-card-title">Status</h2>
              <ReviewStatusBadge status={r.status} deleted={Boolean(r.deleted_at)} />
              <p className="text-sm text-muted-foreground">{nextStep(r)}</p>
            </div>
            {!r.deleted_at && r.status !== "returned" ? (
              <div className="flex flex-col gap-2">
                {r.status !== "removed" ? (
                  <FormField id="review-note" label="Reason (needed to send back or take down)" error={noteError ?? undefined} hint="The writer sees this.">
                    <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The receipt is from a different shop" />
                  </FormField>
                ) : null}
                {waiting ? (
                  <>
                    <Button disabled={busy !== null} onClick={() => run("approve", { title: "Approve this review?", description: "It goes up on the place page with a “Verified visit” badge, and the stars are recounted.", confirmLabel: "Approve" })}>
                      {spin("approve") ?? <CircleCheck />}
                      Approve and show
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => run("return", { title: "Send this review back?", description: "The writer sees your reason. A receipt photo is deleted.", confirmLabel: "Send back" }, true)}>
                      {spin("return") ?? <Undo2 />}
                      Send back to the writer
                    </Button>
                  </>
                ) : null}
                {r.status === "visible" && r.open_reports ? (
                  <Button variant="outline" disabled={busy !== null} onClick={() => run("dismiss_reports", { title: "Close the reports and keep the review?", confirmLabel: "Keep it up" })}>
                    {spin("dismiss_reports") ?? <FlagOff />}
                    Keep it, close reports
                  </Button>
                ) : null}
                {r.status === "visible" ? (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={busy !== null}
                    onClick={() => run("remove", { title: "Take this review down?", description: "It disappears from the place page and the stars are recounted. Open reports are closed.", confirmLabel: "Take down", danger: true }, true)}
                  >
                    {spin("remove") ?? <EyeOff />}
                    Take down
                  </Button>
                ) : null}
                {r.status === "removed" ? (
                  <Button variant="outline" disabled={busy !== null} onClick={() => run("restore", { title: "Put this review back?", confirmLabel: "Put back" })}>
                    {spin("restore") ?? <RotateCcw />}
                    Put back
                  </Button>
                ) : null}
              </div>
            ) : null}
            {r.status === "visible" && r.place ? (
              <Button variant="ghost" asChild>
                <a href={publicPlaceUrl(r.place.sector, r.place.slug)} target="_blank" rel="noopener">
                  <ExternalLink />
                  View the place page
                </a>
              </Button>
            ) : null}
            {r.moderated_at ? (
              <dl className="review-history grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t pt-3 text-sm">
                <dt className="text-muted-foreground">Last check</dt>
                <dd>{formatDateTime(r.moderated_at)}</dd>
                <dt className="text-muted-foreground">By</dt>
                <dd>{r.moderator?.name ?? "—"}</dd>
                {r.moderation_note ? (
                  <>
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd className="whitespace-pre-line">{r.moderation_note}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
