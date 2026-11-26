"use client";

import { FormField } from "@/components/form-field";
import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useDirectoryAreas } from "@/lib/directory";
import { notify } from "@/lib/notify";
import type { GeocodeResult, HoursRow } from "@cendol/api-client";
import { MapView, type MapPoint } from "@cendol/map";
import { Loader2, MapPin, Search, Star, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { HoursEditor } from "./hours-editor";

export interface LocationDraft {
  /** stable key for drag and drop (the branch id once saved) */
  key: string;
  id?: string;
  label: string;
  address: string;
  postcode: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  hours_note: string;
  is_primary: boolean;
  hours: HoursRow[];
}

export function emptyLocation(primary: boolean): LocationDraft {
  return {
    key: `new-${Math.random().toString(36).slice(2, 10)}`,
    label: "",
    address: "",
    postcode: "",
    area: "",
    latitude: null,
    longitude: null,
    phone: "",
    hours_note: "",
    is_primary: primary,
    hours: [],
  };
}

interface LocationCardProps {
  index: number;
  value: LocationDraft;
  onChange: (changes: Partial<LocationDraft>) => void;
  onRemove?: () => void;
  onMakePrimary: () => void;
  /** server errors for this branch, keyed without the "locations.N." prefix */
  errors: Record<string, string>;
}

/** One branch: address, a pin on the map, phone and opening hours. */
export function LocationCard({ index, value, onChange, onRemove, onMakePrimary, errors }: LocationCardProps) {
  const areas = useDirectoryAreas();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<(MapPoint & { zoom?: number }) | null>(null);
  const prefix = `location-${value.key}`;
  const point = value.latitude !== null && value.longitude !== null ? { latitude: value.latitude, longitude: value.longitude } : null;

  async function findAddress() {
    const q = (search || [value.address, value.postcode, "Melaka"].filter(Boolean).join(", ")).trim();
    if (q.length < 3) {
      notify.info("Type the address first, then search.");
      return;
    }
    setSearching(true);
    try {
      const found = (await api.get<{ data: GeocodeResult[] }>("admin/directory/geocode", { q })).data;
      setResults(found);
      if (!found.length) notify.info("No match for that address. You can click the map to drop the pin instead.");
    } catch (error) {
      notify.error(error);
    } finally {
      setSearching(false);
    }
  }

  function pick(result: GeocodeResult) {
    onChange({ latitude: result.latitude, longitude: result.longitude });
    setFocus({ latitude: result.latitude, longitude: result.longitude, zoom: 17 });
    setResults(null);
  }

  function chooseArea(slug: string) {
    onChange({ area: slug === "none" ? "" : slug });
    if (point || slug === "none") return;
    const area = (areas.data ?? []).flatMap((d) => [d, ...d.children]).find((a) => a.slug === slug);
    if (area?.latitude && area.longitude) setFocus({ latitude: area.latitude, longitude: area.longitude, zoom: 15 });
  }

  const hourErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith("hours."))
      .map(([k, m]) => [Number(k.split(".")[1]), m]),
  );

  return (
    <div className="location-card flex flex-col gap-4 p-4">
      <div className="location-card-head flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading font-bold">
          {value.label || (index === 0 ? "Main address" : `Branch ${index + 1}`)}
          {value.is_primary ? <span className="ml-2 text-xs font-semibold text-pandan-700 dark:text-pandan-300">Main</span> : null}
        </h3>
        <div className="flex gap-1">
          {!value.is_primary ? <IconAction icon={Star} label="Make this the main address" onClick={onMakePrimary} /> : null}
          {onRemove ? <IconAction icon={Trash2} label="Remove this branch" danger onClick={onRemove} /> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-label`} label="Branch name (optional)" hint="e.g. Jonker Street, AEON Bandaraya" error={errors.label}>
          <Input id={`${prefix}-label`} value={value.label} onChange={(e) => onChange({ label: e.target.value })} />
        </FormField>
        <FormField id={`${prefix}-area`} label="Area" error={errors.area}>
          <Select value={value.area || "none"} onValueChange={chooseArea}>
            <SelectTrigger id={`${prefix}-area`} className="w-full">
              <SelectValue placeholder="Choose an area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {(areas.data ?? []).map((district) => (
                <SelectGroup key={district.slug}>
                  <SelectLabel>{district.name}</SelectLabel>
                  <SelectItem value={district.slug}>All of {district.name}</SelectItem>
                  {district.children.map((place) => (
                    <SelectItem key={place.slug} value={place.slug}>
                      {place.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id={`${prefix}-address`} label="Address" error={errors.address} className="sm:col-span-2">
          <Input id={`${prefix}-address`} value={value.address} onChange={(e) => onChange({ address: e.target.value })} autoComplete="off" />
        </FormField>
        <FormField id={`${prefix}-postcode`} label="Postcode" error={errors.postcode}>
          <Input id={`${prefix}-postcode`} inputMode="numeric" value={value.postcode} onChange={(e) => onChange({ postcode: e.target.value })} />
        </FormField>
        <FormField id={`${prefix}-phone`} label="Branch phone (optional)" error={errors.phone}>
          <Input id={`${prefix}-phone`} type="tel" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </FormField>
      </div>

      <div className="location-pin flex flex-col gap-2">
        <span className="text-sm font-medium">Pin on the map</span>
        <div className="location-search flex flex-wrap gap-2">
          <Input
            id={`${prefix}-search`}
            aria-label="Search for the address"
            placeholder="Search an address or landmark"
            className="min-w-0 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void findAddress();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={findAddress} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            Find address
          </Button>
        </div>
        {results?.length ? (
          <ul className="location-search-results flex flex-col divide-y rounded-lg border" aria-label="Address matches">
            {results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button type="button" onClick={() => pick(r)} className="location-search-result flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <MapView
          label={`Map for ${value.label || "this address"}. Click to place the pin, or drag it.`}
          className="location-map h-64 rounded-lg border sm:h-72"
          picker={{ value: point, onChange: (p) => onChange({ latitude: p.latitude, longitude: p.longitude }) }}
          focus={focus}
        />
        {errors.latitude || errors.longitude ? (
          <p className="field-error" role="alert">
            {errors.latitude ?? errors.longitude}
          </p>
        ) : (
          <p className="field-hint">
            {point ? `Pinned at ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. Drag the pin to adjust.` : "Click the map where the entrance is, or search the address above."}
          </p>
        )}
      </div>

      <HoursEditor id={`${prefix}-hours`} value={value.hours} onChange={(hours) => onChange({ hours })} errors={hourErrors} />
      <FormField id={`${prefix}-hours-note`} label="Note about hours (optional)" hint="e.g. Closed on public holidays" error={errors.hours_note}>
        <Input id={`${prefix}-hours-note`} value={value.hours_note} onChange={(e) => onChange({ hours_note: e.target.value })} />
      </FormField>
    </div>
  );
}
