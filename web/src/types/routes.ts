/** What Next passes to pages: route values and the ?query, both as promises. */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type RouteParams<T extends string> = Promise<Record<T, string>>;

/** First value of a ?query entry, trimmed. */
export function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
