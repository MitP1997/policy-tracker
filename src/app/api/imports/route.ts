import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let body: { source?: string; fileName?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const source = typeof body.source === "string" ? body.source.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (source !== "csv" && source !== "excel") {
    return jsonError("source must be 'csv' or 'excel'", "validation", 400);
  }
  if (!fileName) {
    return jsonError("fileName is required", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO imports (id, agency_id, created_by, source, file_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`
    )
    .bind(id, result.agency_id, result.user_id, source, fileName)
    .run();

  return jsonBody({ id }, { status: 201 });
}
