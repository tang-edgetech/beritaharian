import { ComingSoon } from "@/components/site/coming-soon";
import { Store } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Places" };

export default function PlacesPage() {
  return (
    <ComingSoon title="Places worth the trip" icon={<Store className="size-7" aria-hidden />}>
      <p>Hawker stalls, cafés, hotels and more across Melaka, with reviews only from people who really visited.</p>
      <p>We&apos;re building it now. Until then, read what&apos;s happening in the Food and Events sections.</p>
    </ComingSoon>
  );
}
