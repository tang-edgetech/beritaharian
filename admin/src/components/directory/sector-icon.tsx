"use client";

import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { Store } from "lucide-react";

/** Draws a sector's lucide icon by name, falling back to a shop icon for unknown names. */
export function SectorIcon({ name, className }: { name: string; className?: string }) {
  if (!(iconNames as readonly string[]).includes(name)) return <Store className={className} aria-hidden />;
  return <DynamicIcon name={name as IconName} className={className} aria-hidden />;
}

export function isIconName(name: string): boolean {
  return (iconNames as readonly string[]).includes(name);
}
