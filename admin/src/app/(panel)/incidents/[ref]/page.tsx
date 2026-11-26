import { redirect } from "next/navigation";

export default async function IncidentPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  redirect(`/incidents/${ref}/overview`);
}
