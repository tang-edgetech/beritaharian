import type { RouteParams } from "@/types/routes";
import { redirect } from "next/navigation";
import { Suspense } from "react";

/** /business/{id} opens the first tab. */
export default function BusinessPage({ params }: { params: RouteParams<"id"> }) {
  return (
    <Suspense fallback={null}>
      <Go params={params} />
    </Suspense>
  );
}

async function Go({ params }: { params: RouteParams<"id"> }) {
  const { id } = await params;
  redirect(`/business/${id}/listing`);
  return null;
}
