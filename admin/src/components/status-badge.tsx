import { Badge } from "@/components/ui/badge";

const tones = {
  good: "status-badge-good bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-200",
  warning: "status-badge-warning bg-marigold-100 text-marigold-800 dark:bg-marigold-900 dark:text-marigold-200",
  danger: "status-badge-danger bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  neutral: "status-badge-neutral bg-santan-100 text-santan-700 dark:bg-santan-800 dark:text-santan-200",
} as const;

export type StatusTone = keyof typeof tones;

export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className={`status-badge border-transparent ${tones[tone]}`}>
      {children}
    </Badge>
  );
}

const userStatus: Record<string, { tone: StatusTone; label: string }> = {
  active: { tone: "good", label: "Active" },
  suspended: { tone: "warning", label: "Suspended" },
  banned: { tone: "danger", label: "Banned" },
};

export function UserStatusBadge({ status, deleted }: { status: string; deleted?: boolean }) {
  if (deleted) return <StatusBadge tone="neutral">In the bin</StatusBadge>;
  const item = userStatus[status] ?? { tone: "neutral" as const, label: status };
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}
