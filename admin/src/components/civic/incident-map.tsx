"use client";

import type { AdminIncident, NearbyIncident } from "@cendol/api-client";
import { MapView, type MapPin } from "@cendol/map";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { incidentUrl } from "@/lib/civic";

interface IncidentMapProps {
  incident: Pick<AdminIncident, "ref" | "title" | "latitude" | "longitude">;
  nearby?: NearbyIncident[];
  className?: string;
}

/** The report's pin (orange) with nearby reports (grey). Clicking a nearby pin opens that report. */
export function IncidentMap({ incident, nearby = [], className }: IncidentMapProps) {
  const router = useRouter();
  const pins = useMemo<MapPin[]>(
    () => [
      { id: incident.ref, label: `This report: ${incident.title}`, latitude: incident.latitude, longitude: incident.longitude, tone: "satay" },
      ...nearby.map((n) => ({ id: n.ref, label: `${n.ref}: ${n.title} (${n.status_label}, ${n.distance_m} m away)`, latitude: n.latitude, longitude: n.longitude, tone: "santan" as const })),
    ],
    [incident, nearby],
  );

  return (
    <MapView
      // a new report gets a fresh map centred on its pin
      key={incident.ref}
      label={`Map of where ${incident.ref} happened${nearby.length ? `, with ${nearby.length} nearby report${nearby.length === 1 ? "" : "s"}` : ""}`}
      // isolate keeps Leaflet's own layers under popups and menus
      className={["incident-map isolate rounded-lg border", className].filter(Boolean).join(" ")}
      pins={pins}
      center={{ latitude: incident.latitude, longitude: incident.longitude }}
      zoom={16}
      selectedId={incident.ref}
      fitToPins={nearby.length > 0}
      onSelect={(id) => {
        if (id !== incident.ref) router.push(incidentUrl(id));
      }}
    />
  );
}
