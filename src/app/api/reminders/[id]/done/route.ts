import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id } = await params;
  if (!id) return jsonError("Reminder id is required", "validation", 400);

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const existing = await db
    .prepare(
      "SELECT id, agency_id, assigned_to FROM reminders WHERE id = ? AND agency_id = ?"
    )
    .bind(id, result.agency_id)
    .first<{ id: string; agency_id: string; assigned_to: string }>();

  if (!existing) {
    return jsonError("Reminder not found", "not_found", 404);
  }

  if (existing.assigned_to !== result.user_id) {
    return jsonError("Forbidden", "forbidden", 403);
  }

  await db
    .prepare("UPDATE reminders SET status = 'done' WHERE id = ?")
    .bind(id)
    .run();

  return jsonBody({ ok: true, status: "done" });
}
