import type { TruthLabel } from "@cendol/api-client";
import { BadgeCheck, CircleAlert, PencilLine, Zap } from "lucide-react";

const LABELS: Record<TruthLabel, { text: string; title: string; className: string; icon: typeof BadgeCheck }> = {
  verified: {
    text: "Verified",
    title: "Our verifiers checked the facts and sources before publishing.",
    className: "truth-badge-verified text-pandan-700 dark:text-pandan-300",
    icon: BadgeCheck,
  },
  developing: {
    text: "Developing",
    title: "Published quickly because it is urgent. Facts are still being checked and may change.",
    className: "truth-badge-developing text-satay-700 dark:text-satay-400",
    icon: CircleAlert,
  },
  corrected: {
    text: "Corrected",
    title: "This story was corrected after it was published. See the note at the end.",
    className: "truth-badge-corrected text-gula-700 dark:text-gula-300",
    icon: PencilLine,
  },
};

/** Tells readers how far to trust a story. Hover or long-press for what it means. */
export function TruthBadge({ label, breaking, onDark }: { label: TruthLabel | null; breaking?: boolean; onDark?: boolean }) {
  const item = label ? LABELS[label] : null;
  return (
    <span className="truth-badges inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold tracking-wide uppercase">
      {breaking ? (
        <span className={`truth-badge-breaking inline-flex items-center gap-1 ${onDark ? "text-red-300" : "text-red-700 dark:text-red-400"}`}>
          <Zap className="size-3.5" aria-hidden />
          Breaking
        </span>
      ) : null}
      {item ? (
        <span className={`truth-badge inline-flex items-center gap-1 ${onDark ? "text-marigold-300" : item.className}`} title={item.title}>
          <item.icon className="size-3.5" aria-hidden />
          {item.text}
        </span>
      ) : null}
    </span>
  );
}
