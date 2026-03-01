import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";

type ImportErrorRow = {
  row_number: number;
  error_message: string | null;
  raw_json_text: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id } = await params;
  if (!id) {
    return jsonError("Import id is required", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const importRow = await db
    .prepare("SELECT 1 FROM imports WHERE id = ? AND agency_id = ?")
    .bind(id, result.agency_id)
    .first();

  if (!importRow) {
    return jsonError("Import not found", "not_found", 404);
  }

  const rows = await db
    .prepare(
      `SELECT row_number, error_message, raw_json_text
       FROM import_rows
       WHERE import_id = ? AND agency_id = ? AND status = 'invalid'
       ORDER BY row_number ASC`
    )
    .bind(id, result.agency_id)
    .all<ImportErrorRow>();

  const errors = (rows.results ?? []).map((r) => {
    let rawRow: Record<string, unknown> | undefined;
    if (r.raw_json_text) {
      try {
        rawRow = JSON.parse(r.raw_json_text) as Record<string, unknown>;
      } catch {
        rawRow = undefined;
      }
    }
    return {
      rowNumber: r.row_number,
      errorMessage: r.error_message ?? "Unknown error",
      rawRow
    };
  });

  return jsonBody({ errors });
}
