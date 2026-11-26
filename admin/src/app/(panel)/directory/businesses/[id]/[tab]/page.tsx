"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { AuditListing } from "@/components/logs/audit-listing";
import { BusinessForm } from "@/components/directory/business-form";
import { BusinessPhotos } from "@/components/directory/business-photos";
import { BusinessStatusPanel } from "@/components/directory/business-status-panel";
import { BusinessStatusBadge } from "@/components/directory/directory-badges";
import { ReviewListing } from "@/components/directory/review-listing";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ratingText } from "@/lib/directory";
import { notify } from "@/lib/notify";
import type { BusinessFull, MessageResponse } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";

const TABS = ["details", "photos", "reviews", "owners", "activity"] as const;

function OwnersTab({ business }: { business: BusinessFull }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  async function remove(member: BusinessFull["members"][number]) {
    const ok = await confirm({
      title: `Stop ${member.name} managing this place?`,
      description: "They can no longer edit the listing or reply to reviews. They can send a new claim later.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/directory/businesses/${business.id}/members/${member.id}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["directory-business", business.id] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <section className="business-owners panel-card flex flex-col gap-4" aria-labelledby="business-owners-title">
      <div>
        <h2 id="business-owners-title" className="panel-card-title">
          People who manage this place
        </h2>
        <p className="panel-card-description">Owners edit the listing and reply to reviews from the public site. New owners come through claims.</p>
      </div>
      {business.members.length ? (
        <ul className="business-owner-list flex flex-col divide-y rounded-lg border">
          {business.members.map((m) => (
            <li key={m.id} className="business-owner flex items-center gap-3 p-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <Link href={`/users/${m.id}`} className="font-medium hover:underline">
                  {m.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {m.email} · {m.role === "manager" ? "Manager" : "Owner"}
                </span>
              </span>
              {can("directory.manage") ? <IconAction icon={UserMinus} label={`Remove ${m.name}`} danger onClick={() => remove(m)} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nobody has claimed this place yet.</p>
      )}
      {can("directory.claims") ? (
        <Button variant="outline" asChild className="self-start">
          <Link href={`/directory/claims/decided?q=${encodeURIComponent(business.name)}`}>See claims for this place</Link>
        </Button>
      ) : null}
      {business.pending_claims ? (
        <p className="text-sm">
          {business.pending_claims} claim{business.pending_claims === 1 ? " is" : "s are"} waiting.{" "}
          <Link href={`/directory/claims?q=${encodeURIComponent(business.name)}`} className="font-medium underline underline-offset-2">
            Check {business.pending_claims === 1 ? "it" : "them"}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export default function PlaceDetailPage() {
  const { id, tab } = useParams<{ id: string; tab: string }>();
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ["directory-business", id],
    queryFn: () => api.get<{ data: BusinessFull }>(`admin/directory/businesses/${id}`).then((r) => r.data),
  });
  const reviewQuery = useMemo(() => ({ "filter[place]": id }), [id]);

  if (!TABS.includes(tab as (typeof TABS)[number])) notFound();

  const b = query.data;
  const tabs = [
    { href: `/directory/businesses/${id}/details`, label: "Details" },
    { href: `/directory/businesses/${id}/photos`, label: "Photos" },
    ...(can("reviews.moderate") ? [{ href: `/directory/businesses/${id}/reviews`, label: b ? `Reviews (${b.rating_count})` : "Reviews" }] : []),
    { href: `/directory/businesses/${id}/owners`, label: "Owners" },
    ...(can("audit.view") ? [{ href: `/directory/businesses/${id}/activity`, label: "Activity" }] : []),
  ];

  return (
    <>
      <PageHeader
        back="/directory/businesses"
        backLabel="Places"
        title={b ? b.name : <Skeleton className="h-8 w-72" />}
        description={
          b ? (
            <span className="flex flex-wrap items-center gap-2">
              <BusinessStatusBadge status={b.status} deleted={Boolean(b.deleted_at)} />
              {b.sector?.name ?? "No sector"} · {ratingText(b.rating_avg, b.rating_count)} stars from {b.rating_count} review{b.rating_count === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />
      <RouteTabs tabs={tabs} label="Place sections" />
      {query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : b ? (
        <>
          {tab === "details" ? (
            <div className="business-detail grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              {can("directory.manage") ? (
                <BusinessForm key={`${b.id}-${b.updated_at}`} business={b} onSaved={() => undefined} />
              ) : (
                <p className="panel-card text-sm text-muted-foreground">You can approve places, but editing them needs the “Add and edit places” permission.</p>
              )}
              <BusinessStatusPanel business={b} />
            </div>
          ) : null}
          {tab === "photos" ? <BusinessPhotos key={b.updated_at} business={b} /> : null}
          {tab === "reviews" && can("reviews.moderate") ? (
            <ReviewListing name={`place-reviews-${b.id}`} extraQuery={reviewQuery} showPlace={false} emptyTitle="No reviews yet" emptyDescription="Reviews from readers show here, whatever their status." />
          ) : null}
          {tab === "owners" ? <OwnersTab business={b} /> : null}
          {tab === "activity" && can("audit.view") ? <AuditListing name={`place-activity-${b.id}`} extraQuery={{ "filter[subject_business]": b.id }} showAreaFilter={false} /> : null}
        </>
      ) : null}
    </>
  );
}
