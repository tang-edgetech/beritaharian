import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * The API calls this right after a story is published, corrected or taken down,
 * so readers see the change at once instead of after the one-minute cache.
 * Protected by a shared secret (REVALIDATE_SECRET here, WEB_REVALIDATE_SECRET in the API's .env).
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? "";
  const given = request.headers.get("x-revalidate-secret") ?? "";
  const valid = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!valid) return Response.json({ message: "Not allowed." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && /^[A-Za-z0-9-]{1,120}$/.test(t)).slice(0, 20) : [];
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  return Response.json({ revalidated: tags });
}
