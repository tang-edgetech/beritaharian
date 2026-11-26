"use client";

import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import type Supercluster from "supercluster";
import { MELAKA_CENTER } from "./geo";

/*
  The one map component. Everything that touches Leaflet lives in this file, so moving to
  Google Maps later means rewriting this file only; pages keep passing the same props.
  Leaflet needs `window`, so it is loaded in the browser after the first render.
*/

export type MapTone = "pandan" | "marigold" | "gula" | "satay" | "santan";

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapPin extends MapPoint {
  id: string;
  /** shown as a hover tooltip and read by screen readers */
  label: string;
  tone?: MapTone;
}

export interface MapViewProps {
  /** what the map shows, for screen readers, e.g. "Map of places" */
  label: string;
  pins?: MapPin[];
  center?: MapPoint;
  zoom?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** group nearby pins into numbered bubbles (good for many pins) */
  cluster?: boolean;
  /** zoom to show every pin when the pin list changes */
  fitToPins?: boolean;
  /** the reader's position, shown as a blue dot */
  userLocation?: MapPoint | null;
  /** location picker: click the map or drag the pin to choose a point */
  picker?: { value: MapPoint | null; onChange: (point: MapPoint) => void };
  /** move the map here when it changes (e.g. after an address search) */
  focus?: (MapPoint & { zoom?: number }) | null;
  className?: string;
}

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type PinFeature = Supercluster.PointFeature<{ pin: MapPin }>;

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export function MapView({ label, pins = [], center, zoom, selectedId, onSelect, cluster = false, fitToPins = false, userLocation, picker, focus, className }: MapViewProps) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const pinLayer = useRef<Leaflet.LayerGroup | null>(null);
  const extraLayer = useRef<Leaflet.LayerGroup | null>(null);
  const pickerMarker = useRef<Leaflet.Marker | null>(null);
  const [ready, setReady] = useState(false);

  // latest callbacks without re-binding Leaflet events
  const onSelectRef = useRef(onSelect);
  const pickerRef = useRef(picker);
  useEffect(() => {
    onSelectRef.current = onSelect;
    pickerRef.current = picker;
  });

  // create the map once
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as typeof Leaflet);
      if (cancelled || !holder.current || mapRef.current) return;
      leafletRef.current = L;
      const start = center ?? picker?.value ?? MELAKA_CENTER;
      const map = L.map(holder.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true }).setView(
        [start.latitude, start.longitude],
        zoom ?? MELAKA_CENTER.zoom,
      );
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      pinLayer.current = L.layerGroup().addTo(map);
      extraLayer.current = L.layerGroup().addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        pickerRef.current?.onChange({ latitude: round(e.latlng.lat), longitude: round(e.latlng.lng) });
      });
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; later prop changes are applied below
  }, []);

  // pins, with optional clustering
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = pinLayer.current;
    if (!ready || !L || !map || !layer) return;

    const pinIcon = (pin: MapPin) =>
      L.divIcon({
        className: "map-pin-holder",
        html: `<span class="map-pin is-${pin.tone ?? "marigold"}${pin.id === selectedId ? " is-selected" : ""}"><span class="map-pin-dot"></span></span>`,
        iconSize: [30, 38],
        iconAnchor: [15, 36],
        tooltipAnchor: [0, -32],
      });

    const addPin = (pin: MapPin) => {
      const marker = L.marker([pin.latitude, pin.longitude], { icon: pinIcon(pin), title: pin.label, keyboard: true, riseOnHover: true, zIndexOffset: pin.id === selectedId ? 1000 : 0 });
      marker.bindTooltip(escapeHtml(pin.label), { direction: "top", className: "map-tooltip" });
      marker.on("click", () => onSelectRef.current?.(pin.id));
      marker.on("keypress", (e: Leaflet.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === "Enter") onSelectRef.current?.(pin.id);
      });
      layer.addLayer(marker);
    };

    let index: Supercluster<{ pin: MapPin }> | null = null;
    const draw = () => {
      layer.clearLayers();
      if (!cluster || !index) {
        pins.forEach(addPin);
        return;
      }
      const b = map.getBounds();
      const clusters = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(map.getZoom()));
      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; pin?: MapPin };
        if (props.cluster && props.cluster_id !== undefined) {
          const count = props.point_count ?? 0;
          const size = count < 10 ? 36 : count < 100 ? 44 : 52;
          const bubble = L.marker([lat, lng], {
            icon: L.divIcon({ className: "map-cluster-holder", html: `<span class="map-cluster">${count}</span>`, iconSize: [size, size] }),
            title: `${count} places here. Zoom in to see them.`,
            keyboard: true,
          });
          const clusterId = props.cluster_id;
          bubble.on("click", () => map.flyTo([lat, lng], Math.min(index!.getClusterExpansionZoom(clusterId), 18)));
          layer.addLayer(bubble);
        } else if (props.pin) {
          addPin(props.pin);
        }
      }
    };

    if (cluster) {
      void import("supercluster").then((mod) => {
        const SC = (mod as unknown as { default: typeof Supercluster }).default;
        index = new SC<{ pin: MapPin }>({ radius: 56, maxZoom: 17 });
        index.load(pins.map<PinFeature>((pin) => ({ type: "Feature", properties: { pin }, geometry: { type: "Point", coordinates: [pin.longitude, pin.latitude] } })));
        draw();
      });
    } else {
      draw();
    }
    map.on("moveend", draw);
    return () => {
      map.off("moveend", draw);
    };
  }, [ready, pins, cluster, selectedId]);

  // fit to pins when the list changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !fitToPins || pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], Math.max(map.getZoom(), 16));
      return;
    }
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [36, 36], maxZoom: 16 });
  }, [ready, pins, fitToPins]);

  // pan to the selected pin if it is off screen
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const pin = pins.find((p) => p.id === selectedId);
    if (pin && !map.getBounds().contains([pin.latitude, pin.longitude])) map.panTo([pin.latitude, pin.longitude]);
  }, [ready, selectedId, pins]);

  // explicit moves (address search, "near me")
  useEffect(() => {
    if (!ready || !mapRef.current || !focus) return;
    mapRef.current.flyTo([focus.latitude, focus.longitude], focus.zoom ?? Math.max(mapRef.current.getZoom(), 16), { duration: 0.6 });
  }, [ready, focus]);

  // the reader's own position
  useEffect(() => {
    const L = leafletRef.current;
    const layer = extraLayer.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    if (userLocation) {
      L.marker([userLocation.latitude, userLocation.longitude], {
        icon: L.divIcon({ className: "map-me-holder", html: '<span class="map-me"></span>', iconSize: [20, 20] }),
        interactive: false,
        keyboard: false,
      }).addTo(layer);
    }
  }, [ready, userLocation]);

  // picker pin
  const pickerValue = picker?.value ?? null;
  const hasPicker = Boolean(picker);
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (!hasPicker || !pickerValue) {
      pickerMarker.current?.remove();
      pickerMarker.current = null;
      return;
    }
    if (!pickerMarker.current) {
      pickerMarker.current = L.marker([pickerValue.latitude, pickerValue.longitude], {
        draggable: true,
        icon: L.divIcon({ className: "map-pin-holder", html: '<span class="map-pin is-satay is-selected"><span class="map-pin-dot"></span></span>', iconSize: [30, 38], iconAnchor: [15, 36] }),
        title: "Drag to the exact spot",
        keyboard: true,
      }).addTo(map);
      pickerMarker.current.on("dragend", () => {
        const at = pickerMarker.current!.getLatLng();
        pickerRef.current?.onChange({ latitude: round(at.lat), longitude: round(at.lng) });
      });
      map.setView([pickerValue.latitude, pickerValue.longitude], Math.max(map.getZoom(), 16));
    } else {
      pickerMarker.current.setLatLng([pickerValue.latitude, pickerValue.longitude]);
    }
  }, [ready, hasPicker, pickerValue]);

  return (
    <div className={`map-view relative isolate overflow-hidden ${picker ? "is-picker" : ""} ${className ?? ""}`}>
      <div ref={holder} className="map-view-canvas absolute inset-0" role="region" aria-label={label} />
      {!ready ? (
        <div className="map-view-loading absolute inset-0 grid place-items-center text-sm text-current/60" aria-hidden>
          Loading map…
        </div>
      ) : null}
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}
