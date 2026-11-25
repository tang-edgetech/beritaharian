import { ComingSoon } from "@/components/site/coming-soon";
import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <ComingSoon title="Melaka on a map" icon={<MapIcon className="size-7" aria-hidden />}>
      <p>Stories, places and verified community reports, pinned where they happen, with &ldquo;near me&rdquo; on your phone.</p>
      <p>Coming with the places directory.</p>
    </ComingSoon>
  );
}
