import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth, requireOwner } from "@/lib/auth/session";
import { getReminderRules } from "@/lib/reminders";

export async function GET(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const rules = await getReminderRules(db, result.agency_id);
  return jsonBody({ rules });
}

export async function PUT(request: Request): Promise<Response> {
  const result = await requireOwner(request);
  if (result instanceof Response) return result;

  let body: { rules?: { daysBefore: number; enabled?: boolean }[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const rules = Array.isArray(body.rules) ? body.rules : [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (typeof r.daysBefore !== "number" || r.daysBefore < 1) {
      return jsonError(
        `rules[${i}].daysBefore must be a positive number`,
        "validation",
        400
      );
    }
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  await db
    .prepare("DELETE FROM reminder_rules WHERE agency_id = ?")
    .bind(result.agency_id)
    .run();

  for (const r of rules) {
    const enabled = r.enabled !== false ? 1 : 0;
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO reminder_rules (id, agency_id, days_before, enabled, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
      .bind(id, result.agency_id, r.daysBefore, enabled)
      .run();
  }

  const updated = await getReminderRules(db, result.agency_id);
  return jsonBody({ rules: updated });
}
