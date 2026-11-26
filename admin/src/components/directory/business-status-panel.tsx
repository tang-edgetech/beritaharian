"use client";

import { useConfirm, type ConfirmOptions } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { publicPlaceUrl } from "@/lib/directory";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { BusinessFull, MessageResponse } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, CircleCheck, ExternalLink, EyeOff, Loader2, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusinessStatusBadge } from "./directory-badges";

function nextStep(b: BusinessFull): string {
  if (b.deleted_at) return "Deleted. Restore it to work on it again.";
  if (b.status === "pending") return b.submitted_note ? "Suggested by a reader. Check the details and the pin, then approve." : "Waiting for approval before it shows on the map.";
  if (b.status === "suspended") return "Not on the site. Readers can't see the page or write reviews.";
  return "On the map. Readers can find it and write reviews.";
}

/** Status and the big decisions for a place: approve, take off the map, put back, delete. */
export function BusinessStatusPanel({ business }: { business: BusinessFull }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(data?: BusinessFull) {
    if (data) queryClient.setQueryData(["directory-business", business.id], data);
    else await queryClient.invalidateQueries({ queryKey: ["directory-business", business.id] });
    await queryClient.invalidateQueries({ queryKey: ["listing"] });
    await queryClient.invalidateQueries({ queryKey: ["directory-summary"] });
  }

  async function status(action: "approve" | "suspend" | "reinstate", options: ConfirmOptions) {
    if (action === "suspend" && !note.trim()) {
      setNoteError("Please write why, so the owner can be told.");
      return;
    }
    setNoteError(null);
    if (!(await confirm(options))) return;
    setBusy(action);
    try {
      const result = await api.post<{ message: string; data: BusinessFull }>(`admin/directory/businesses/${business.id}/status`, { action, note: note.trim() || null });
      notify.success(result.message);
      setNote("");
      await refresh(result.data);
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!(await confirm({ title: `Delete “${business.name}”?`, description: "It disappears from the site and goes to the deleted list, where you can restore it.", confirmLabel: "Delete", danger: true }))) return;
    setBusy("delete");
    try {
      notify.success((await api.delete<MessageResponse>(`admin/directory/businesses/${business.id}`)).message);
      await refresh();
      router.push("/directory/businesses");
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      notify.success((await api.post<MessageResponse>(`admin/directory/businesses/${business.id}/restore`)).message);
      await refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  const spin = (key: string) => (busy === key ? <Loader2 className="animate-spin" /> : null);
  const manage = can("directory.manage");

  return (
    <aside className="business-status-panel panel-card flex flex-col gap-4 lg:sticky lg:top-20" aria-label="Place status">
      <div className="flex flex-col gap-2">
        <h2 className="panel-card-title">Status</h2>
        <BusinessStatusBadge status={business.status} deleted={Boolean(business.deleted_at)} />
        <p className="text-sm text-muted-foreground">{nextStep(business)}</p>
      </div>

      {business.submitted_note && business.submitted_note !== "sample" ? (
        <div className="business-submitted-note rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">Note from {business.created_by?.name ?? "the reader"}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{business.submitted_note}</p>
        </div>
      ) : null}
      {business.status === "suspended" && business.moderation_note ? (
        <div className="business-moderation-note rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/40">
          <p className="font-medium">Why it was taken off</p>
          <p className="mt-1 whitespace-pre-line">{business.moderation_note}</p>
        </div>
      ) : null}

      {!business.deleted_at ? (
        <div className="flex flex-col gap-2">
          {business.status === "pending" && can("directory.claims") ? (
            <Button disabled={busy !== null} onClick={() => status("approve", { title: "Approve this place?", description: "It appears on the map straight away and readers can review it.", confirmLabel: "Approve" })}>
              {spin("approve") ?? <CircleCheck />}
              Approve and put on the map
            </Button>
          ) : null}
          {business.status === "suspended" && manage ? (
            <Button variant="outline" disabled={busy !== null} onClick={() => status("reinstate", { title: "Put this place back on the map?", confirmLabel: "Put back" })}>
              {spin("reinstate") ?? <RotateCcw />}
              Put back on the map
            </Button>
          ) : null}
          {business.status !== "suspended" && manage ? (
            <>
              <FormField id="business-status-note" label="Reason (needed to take it off the map)" error={noteError ?? undefined}>
                <Textarea id="business-status-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Closed for good, or the owner asked us to" />
              </FormField>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => status("suspend", { title: "Take this place off the map?", description: "The page and its reviews stop showing until you put it back.", confirmLabel: "Take off", danger: true })}
              >
                {spin("suspend") ?? <EyeOff />}
                Take off the map
              </Button>
            </>
          ) : null}
          {business.status === "active" ? (
            <Button variant="ghost" asChild>
              <a href={publicPlaceUrl(business.sector?.slug, business.slug)} target="_blank" rel="noopener">
                <ExternalLink />
                View on the site
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <dl className="business-facts grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t pt-3 text-sm">
        <dt className="text-muted-foreground">Added</dt>
        <dd>{formatDateTime(business.created_at)}</dd>
        <dt className="text-muted-foreground">By</dt>
        <dd className="truncate">{business.created_by?.name ?? "—"}</dd>
        {business.approved_at ? (
          <>
            <dt className="text-muted-foreground">Approved</dt>
            <dd>{formatDateTime(business.approved_at)}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Owners</dt>
        <dd>
          {business.members.length ? business.members.map((m) => m.name).join(", ") : "Not claimed"}
          {business.pending_claims ? (
            <Link href={`/directory/claims?q=${encodeURIComponent(business.name)}`} className="ml-1 text-marigold-700 underline underline-offset-2 dark:text-marigold-300">
              {business.pending_claims} claim{business.pending_claims === 1 ? "" : "s"} waiting
            </Link>
          ) : null}
        </dd>
      </dl>

      {manage ? (
        business.deleted_at ? (
          <Button variant="outline" disabled={busy !== null} onClick={restore}>
            {spin("restore") ?? <ArchiveRestore />}
            Restore
          </Button>
        ) : (
          <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy !== null} onClick={remove}>
            {spin("delete") ?? <Trash2 />}
            Delete place
          </Button>
        )
      ) : null}
    </aside>
  );
}
