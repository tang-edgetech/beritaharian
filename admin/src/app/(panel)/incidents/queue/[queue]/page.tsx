"use client";

import { IncidentListing } from "@/components/civic/incident-listing";
import { IncidentPreview } from "@/components/civic/incident-preview";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { useAuth } from "@/lib/auth";
import { QUEUES, useIncidentSummary } from "@/lib/civic";
import { MousePointerClick } from "lucide-react";
import { notFound, useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function IncidentQueuePage() {
  const { queue } = useParams<{ queue: string }>();
  const { can } = useAuth();
  const summary = useIncidentSummary();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = search.get("selected");
  const current = QUEUES.find((q) => q.key === queue);

  const setSelected = useCallback(
    (ref: string | null) => {
      const next = new URLSearchParams(search.toString());
      if (ref) next.set("selected", ref);
      else next.delete("selected");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [search, router, pathname],
  );

  if (!current) notFound();

  if (!["incidents.view", "incidents.verify", "incidents.export"].some((p) => can(p))) {
    return <p className="panel-card">You don&apos;t have permission to see reports.</p>;
  }

  const tabs = QUEUES.map((q) => {
    const count = summary.data && q.count ? q.count(summary.data) : null;
    return { href: `/incidents/queue/${q.key}`, label: count !== null ? `${q.label} (${count})` : q.label };
  });

  return (
    <>
      <PageHeader title="Reports from readers" description={current.description} />
      <RouteTabs label="Report queues" tabs={tabs} />
      <div className="incident-queue grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <IncidentListing queue={current.key} selected={selected} onSelect={setSelected} />
        <div className="incident-queue-side hidden xl:block">
          {selected ? (
            <IncidentPreview key={selected} reference={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="incident-preview-empty flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              <MousePointerClick className="size-6" aria-hidden />
              Click a report to preview it here, with its map and quick actions.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
