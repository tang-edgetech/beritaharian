/** Melaka Tengah, where the map opens when nothing else is known. */
export const MELAKA_CENTER = { latitude: 2.196, longitude: 102.248, zoom: 13 } as const;

/** "120 m away", "2.4 km away" */
export function distanceLabel(metres: number | null | undefined): string | null {
  if (metres === null || metres === undefined) return null;
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m away`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km away`;
}
