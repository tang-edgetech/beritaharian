"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { ClaimStatusBadge } from "@/components/directory/directory-badges";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { saveFile } from "@/lib/billing";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { BusinessClaim, MessageResponse } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Download, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["directory-claim", id],
    queryFn: () => api.get<{ data: BusinessClaim }>(`admin/directory/claims/${id}`).then((r) => r.data),
  });
  const c = query.data;

  async function decide(action: "approve" | "reject") {
    if (!c) return;
    if (action === "reject" && !note.trim()) {
      setNoteError("Please write why, so the person knows what to send next time.");
      return;
    }
    setNoteError(null);
    const ok = await confirm(
      action === "approve"
        ? { title: `Let ${c.user?.name ?? "this person"} manage ${c.place?.name ?? "this place"}?`, description: "They can edit the listing and reply to reviews straight away.", confirmLabel: "Approve" }
        : { title: "Turn this claim down?", description: "The person sees your reason. Their document is deleted.", confirmLabel: "Turn down", danger: true },
    );
    if (!ok) return;
    setBusy(action);
    try {
      notify.success((await api.post<MessageResponse>(`admin/directory/claims/${c.id}/decide`, { action, note: note.trim() || null })).message);
      setNote("");
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["listing"] }),
        queryClient.invalidateQueries({ queryKey: ["directory-summary"] }),
        c.place ? queryClient.invalidateQueries({ queryKey: ["directory-business", c.place.id] }) : null,
      ]);
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  const ssmMismatch = c?.ssm_number && c.place?.ssm_number && c.ssm_number.replace(/\W/g, "") !== c.place.ssm_number.replace(/\W/g, "");

  return (
    <>
      <PageHeader
        back="/directory/claims"
        backLabel="Claims"
        title={c ? `Claim for ${c.place?.name ?? "a deleted place"}` : <Skeleton className="h-8 w-72" />}
        description={c ? <span className="flex flex-wrap items-center gap-2"><ClaimStatusBadge status={c.status} /> Sent {formatDateTime(c.created_at)}</span> : null}
      />
      {query.isPending ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : c ? (
        <div className="claim-detail grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="panel-card flex flex-col gap-3" aria-labelledby="claim-who-title">
              <h2 id="claim-who-title" className="panel-card-title">
                Who is asking
              </h2>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <Fact label="Name">{c.user ? <Link href={`/users/${c.user.id}`} className="font-medium hover:underline">{c.user.name}</Link> : "—"}</Fact>
                <Fact label="E-mail">{c.user?.email ?? "—"}</Fact>
                <Fact label="Phone">{c.phone}</Fact>
                <Fact label="Role">{c.role === "manager" ? "Manager" : "Owner"}</Fact>
                {c.note ? <Fact label="Their note"><span className="whitespace-pre-line">{c.note}</span></Fact> : null}
              </dl>
            </section>

            <section className="panel-card flex flex-col gap-3" aria-labelledby="claim-proof-title">
              <h2 id="claim-proof-title" className="panel-card-title">
                Proof
              </h2>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <Fact label="SSM no. given">{c.ssm_number ?? "Not given"}</Fact>
                <Fact label="SSM no. on listing">{c.place?.ssm_number ?? "Not on the listing yet"}</Fact>
              </dl>
              {ssmMismatch ? (
                <p className="claim-mismatch flex items-start gap-2 rounded-lg bg-marigold-50 p-3 text-sm text-marigold-900 dark:bg-marigold-900/30 dark:text-marigold-100">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  The SSM numbers don&apos;t match. Check the SSM e-Search before approving.
                </p>
              ) : null}
              {c.has_document ? (
                <Button variant="outline" className="self-start" onClick={() => saveFile(`admin/directory/claims/${c.id}/document`)}>
                  <Download />
                  Download their document
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{c.status === "rejected" ? "The document was deleted when the claim was turned down." : "No document uploaded."}</p>
              )}
            </section>

            <section className="panel-card flex flex-col gap-3" aria-labelledby="claim-place-title">
              <h2 id="claim-place-title" className="panel-card-title">
                The place
              </h2>
              {c.place ? (
                <Link href={`/directory/businesses/${c.place.id}/details`} className="font-medium hover:underline">
                  {c.place.name}
                </Link>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {c.managers?.length ? `Managed now by ${c.managers.map((m) => `${m.name} (${m.role})`).join(", ")}.` : "Nobody manages it yet."}
              </p>
              {c.other_claims?.length ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Other claims for this place</h3>
                  <ul className="flex flex-col divide-y rounded-lg border text-sm">
                    {c.other_claims.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2 p-2.5">
                        <Link href={`/directory/claims/${o.id}`} className="font-medium hover:underline">
                          {o.user?.name ?? "Someone"}
                        </Link>
                        <ClaimStatusBadge status={o.status} />
                        <span className="text-muted-foreground">{formatDateTime(o.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="claim-decision panel-card flex flex-col gap-4 lg:sticky lg:top-20" aria-label="Decision">
            <h2 className="panel-card-title">Decision</h2>
            {c.status === "pending" ? (
              <>
                <FormField id="claim-note" label="Note (needed to turn it down)" error={noteError ?? undefined} hint="The person sees this.">
                  <Textarea id="claim-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please upload your SSM certificate" />
                </FormField>
                <Button disabled={busy !== null} onClick={() => decide("approve")}>
                  {busy === "approve" ? <Loader2 className="animate-spin" /> : <CircleCheck />}
                  Approve
                </Button>
                <Button variant="outline" disabled={busy !== null} onClick={() => decide("reject")}>
                  {busy === "reject" ? <Loader2 className="animate-spin" /> : <CircleX />}
                  Turn down
                </Button>
              </>
            ) : (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <Fact label="Decided">{formatDateTime(c.decided_at)}</Fact>
                <Fact label="By">{c.decided_by?.name ?? "—"}</Fact>
                {c.decision_note ? <Fact label="Note"><span className="whitespace-pre-line">{c.decision_note}</span></Fact> : null}
              </dl>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
