import { StatusBadge } from "@/components/status-badge";
import { ARTICLE_STATUS, TRUTH_LABEL } from "@/lib/news";
import type { AdminArticle } from "@cendol/api-client";
import { Zap } from "lucide-react";

/** Status, plus the truth label and breaking flag readers will see. */
export function ArticleBadges({ article }: { article: Pick<AdminArticle, "status" | "truth_label" | "is_breaking" | "is_featured" | "is_live"> }) {
  const status = ARTICLE_STATUS[article.status];
  return (
    <span className="article-badges flex flex-wrap items-center gap-1">
      <StatusBadge tone={status.tone}>{article.status === "scheduled" && article.is_live ? "Live" : status.label}</StatusBadge>
      {article.is_breaking ? (
        <StatusBadge tone="danger">
          <Zap className="size-3" />
          Breaking
        </StatusBadge>
      ) : null}
      {article.is_live && article.truth_label && article.truth_label !== "verified" ? (
        <StatusBadge tone={TRUTH_LABEL[article.truth_label].tone}>{TRUTH_LABEL[article.truth_label].label}</StatusBadge>
      ) : null}
      {article.is_featured ? <StatusBadge tone="good">Lead story</StatusBadge> : null}
    </span>
  );
}
