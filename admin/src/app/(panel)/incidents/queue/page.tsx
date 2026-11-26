import { redirect } from "next/navigation";

export default function IncidentQueuesPage() {
  redirect("/incidents/queue/check");
}
