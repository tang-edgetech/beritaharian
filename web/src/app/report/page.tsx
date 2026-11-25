import { ComingSoon } from "@/components/site/coming-soon";
import { Siren } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Report something" };

export default function ReportPage() {
  return (
    <ComingSoon title="Tell us what you saw" icon={<Siren className="size-7" aria-hidden />}>
      <p>Soon you can report floods, road damage or anything happening on your street, with photos and the exact place on a map.</p>
      <p>Our verifiers check every report. You can choose to hide your name from the public; only our verifiers will see it.</p>
      <p>For emergencies, call 999 now.</p>
    </ComingSoon>
  );
}
