import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { getTodayInTimezone } from "@/lib/date";
import { getTodaysReminders } from "@/lib/reminders";

export async function GET(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const timezoneRow = await db
    .prepare("SELECT timezone FROM agencies WHERE id = ?")
    .bind(result.agency_id)
    .first<{ timezone: string }>();

  const timezone = timezoneRow?.timezone ?? "Asia/Kolkata";
  const today = getTodayInTimezone(timezone);

  const reminders = await getTodaysReminders(
    db,
    result.agency_id,
    result.user_id,
    today
  );

  return jsonBody({ reminders });
}
