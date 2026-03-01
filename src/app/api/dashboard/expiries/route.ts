import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { getExpiryBuckets } from "@/lib/dashboard";

const MIN_WINDOW_DAYS = 1;
const MAX_WINDOW_DAYS = 365;
const DEFAULT_WINDOW_DAYS = 60;

export async function GET(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window_days");
  const windowDays = windowParam
    ? Math.min(
        MAX_WINDOW_DAYS,
        Math.max(MIN_WINDOW_DAYS, parseInt(windowParam, 10) || DEFAULT_WINDOW_DAYS)
      )
    : DEFAULT_WINDOW_DAYS;

  const buckets = await getExpiryBuckets(db, result, windowDays);

  return jsonBody({ buckets });
}
