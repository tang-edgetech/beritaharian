"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { publicArticleUrl } from "@/lib/news";
import type { AdminArticle, ArticleAction, MessageResponse } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  Send,
  Star,
  StarOff,
  Trash2,
  Undo2,
  XCircle,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArticleBadges } from "./news-badges";

/** Who should act next, in plain words. */
function nextStep(article: AdminArticle): string {
  switch (article.status) {
    case "draft":
      return article.review_note ? "Sent back to the writer. Make the changes, then send it for fact-check again." : "The writer is still working on it.";
    case "in_review":
      return "Waiting for a verifier to check the facts and sources.";
    case "verified":
      return "Facts checked. An editor can publish or schedule it.";
    case "scheduled":
      return article.is_live ? "Live on the site." : `Goes live ${formatDateTime(article.published_at)}.`;
    case "published":
      return article.truth_label === "developing" ? "Live as developing news. A verifier should check it soon." : "Live on the site.";
    case "archived":
      return "Not on the site. Restore it to a draft to work on it again.";
  }
}

interface WorkflowPanelProps {
  article: AdminArticle;
  /** Unsaved edits in the form: workflow steps wait until they are saved. */
  dirty: boolean;
}

export function WorkflowPanel({ article, dirty }: WorkflowPanelProps) {
  const confirm = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const can = (action: ArticleAction) => article.actions?.includes(action) ?? false;
  const needsNote = can("send_back") || can("reject") || can("archive");

  async function run(action: string, options?: { needsNote?: boolean; confirm?: Parameters<typeof confirm>[0]; publishAt?: string }) {
    if (dirty) {
      notify.info("Save your changes first.");
      return;
    }
    if (options?.needsNote && !note.trim()) {
      setNoteError("Please write a short note so the writer knows why.");
      return;
    }
    setNoteError(null);
    if (options?.confirm && !(await confirm(options.confirm))) return;
    setBusy(action);
    try {
      const result = await api.post<{ message: string; data: AdminArticle }>(`admin/news/articles/${article.id}/workflow`, {
        action,
        note: note.trim() || null,
        publish_at: options?.publishAt ? new Date(options.publishAt).toISOString() : null,
      });
      notify.success(result.message);
      queryClient.setQueryData(["article", article.id], result.data);
      setNote("");
      setPublishAt("");
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      await queryClient.invalidateQueries({ queryKey: ["news-summary"] });
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirm({ title: "Delete this story?", description: "It is removed from the newsroom. This can't be undone from here.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/news/articles/${article.id}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      router.push("/news");
    } catch (error) {
      notify.error(error);
    }
  }

  const spin = (action: string) => (busy === action ? <Loader2 className="animate-spin" /> : null);

  return (
    <aside className="workflow-panel panel-card flex flex-col gap-4 lg:sticky lg:top-20" aria-label="Story status and next step">
      <div className="flex flex-col gap-2">
        <h2 className="panel-card-title">Status</h2>
        <ArticleBadges article={article} />
        <p className="text-sm text-muted-foreground">{nextStep(article)}</p>
      </div>

      {article.review_note && article.status !== "archived" ? (
        <div className="workflow-note flex gap-2 rounded-lg border border-marigold-300 bg-marigold-50 p-3 text-sm dark:border-marigold-800 dark:bg-marigold-900/30">
          <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-marigold-700" />
          <p className="whitespace-pre-line">{article.review_note}</p>
        </div>
      ) : null}
      {article.status === "archived" && article.archived_reason ? (
        <p className="rounded-lg bg-muted p-3 text-sm">Reason: {article.archived_reason}</p>
      ) : null}

      {dirty ? <p className="text-sm font-medium text-marigold-700 dark:text-marigold-300">Save your changes before moving the story on.</p> : null}

      <div className="workflow-actions flex flex-col gap-2">
        {can("submit") ? (
          <Button onClick={() => run("submit")} disabled={busy !== null}>
            {spin("submit") ?? <Send />}
            Send for fact-check
          </Button>
        ) : null}
        {can("verify") ? (
          <Button
            onClick={() =>
              run("verify", {
                confirm: {
                  title: "Mark the facts as checked?",
                  description: "Only do this after checking every source. Your name is recorded as the verifier.",
                  confirmLabel: "Verified",
                },
              })
            }
            disabled={busy !== null}
          >
            {spin("verify") ?? <BadgeCheck />}
            Facts checked: verify
          </Button>
        ) : null}
        {can("publish") ? (
          <>
            <Button
              onClick={() => run("publish", { confirm: { title: "Publish this story now?", description: "It goes live on the site straight away.", confirmLabel: "Publish" } })}
              disabled={busy !== null}
            >
              {spin("publish") ?? <Send />}
              Publish now
            </Button>
            <div className="workflow-schedule flex flex-col gap-1.5 rounded-lg border p-3">
              <FormField id="workflow-publish-at" label="Or schedule for later">
                <Input id="workflow-publish-at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
              </FormField>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null || !publishAt}
                onClick={() => run("publish", { publishAt })}
              >
                {spin("schedule") ?? <CalendarClock />}
                Schedule
              </Button>
            </div>
          </>
        ) : null}
        {can("publish_breaking") ? (
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
            onClick={() =>
              run("publish_breaking", {
                confirm: {
                  title: "Publish as breaking news?",
                  description: "It goes live now, before fact-checking, with a “Developing” label. A verifier must check it as soon as possible.",
                  confirmLabel: "Publish breaking news",
                  danger: true,
                },
              })
            }
            disabled={busy !== null}
          >
            {spin("publish_breaking") ?? <Zap />}
            Publish as breaking
          </Button>
        ) : null}
        {can("feature") ? (
          <Button variant="outline" onClick={() => run(article.is_featured ? "unfeature" : "feature")} disabled={busy !== null}>
            {article.is_featured ? <StarOff /> : <Star />}
            {article.is_featured ? "Stop being the lead story" : "Make it the lead story"}
          </Button>
        ) : null}
        {can("restore") ? (
          <Button variant="outline" onClick={() => run("restore")} disabled={busy !== null}>
            {spin("restore") ?? <ArchiveRestore />}
            Restore to draft
          </Button>
        ) : null}
        {article.is_live ? (
          <Button asChild variant="ghost">
            <a href={publicArticleUrl(article.category?.slug, article.slug)} target="_blank" rel="noreferrer">
              <ExternalLink />
              View on the site
            </a>
          </Button>
        ) : null}
      </div>

      {needsNote ? (
        <div className="workflow-note-actions flex flex-col gap-2 border-t pt-4">
          <FormField id="workflow-note" label="Note to the writer" error={noteError ?? undefined} hint="Needed when sending back, rejecting or taking down.">
            <Textarea id="workflow-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {can("send_back") ? (
              <Button variant="outline" size="sm" onClick={() => run("send_back", { needsNote: true })} disabled={busy !== null}>
                {spin("send_back") ?? <Undo2 />}
                Send back
              </Button>
            ) : null}
            {can("reject") ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run("reject", {
                    needsNote: true,
                    confirm: { title: "Reject this story?", description: "It is archived with your note. An editor can restore it later.", confirmLabel: "Reject", danger: true },
                  })
                }
                disabled={busy !== null}
              >
                {spin("reject") ?? <XCircle />}
                Reject
              </Button>
            ) : null}
            {can("archive") ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  run("archive", {
                    needsNote: true,
                    confirm: { title: "Take this story off the site?", description: "Readers will no longer find it. You can restore it later.", confirmLabel: "Take down", danger: true },
                  })
                }
                disabled={busy !== null}
              >
                {spin("archive") ?? <Archive />}
                Take off the site
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {can("delete") ? (
        <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={remove}>
          <Trash2 />
          Delete story
        </Button>
      ) : null}

      <dl className="workflow-facts grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <dt>Writer</dt>
        <dd className="text-foreground">{article.author?.name}</dd>
        {article.verified_by ? (
          <>
            <dt>Verified by</dt>
            <dd className="text-foreground">
              {article.verified_by}, {formatDateTime(article.verified_at)}
            </dd>
          </>
        ) : null}
        {article.published_by ? (
          <>
            <dt>Published by</dt>
            <dd className="text-foreground">
              {article.published_by}, {formatDateTime(article.published_at)}
            </dd>
          </>
        ) : null}
        <dt>Reads</dt>
        <dd className="text-foreground tabular-nums">{article.view_count.toLocaleString("en-MY")}</dd>
      </dl>
    </aside>
  );
}
