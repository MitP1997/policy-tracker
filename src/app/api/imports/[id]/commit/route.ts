import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";

type ImportRow = {
  id: string;
  status: string;
  total_rows: number | null;
  success_rows: number | null;
  failed_rows: number | null;
  created_at: string;
  completed_at: string | null;
};

function toImport(r: ImportRow) {
  return {
    id: r.id,
    status: r.status,
    totalRows: r.total_rows,
    successRows: r.success_rows,
    failedRows: r.failed_rows,
    createdAt: r.created_at,
    completedAt: r.completed_at
  };
}

export async function POST(
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

  const row = await db
    .prepare(
      `SELECT id, status, total_rows, success_rows, failed_rows, created_at, completed_at
       FROM imports WHERE id = ? AND agency_id = ?`
    )
    .bind(id, result.agency_id)
    .first<ImportRow>();

  if (!row) {
    return jsonError("Import not found", "not_found", 404);
  }
  if (row.status !== "pending" && row.status !== "processing") {
    return jsonError("Import cannot be committed", "validation", 400);
  }

  await db
    .prepare("UPDATE imports SET status = 'completed', completed_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();

  const updated = await db
    .prepare(
      `SELECT id, status, total_rows, success_rows, failed_rows, created_at, completed_at
       FROM imports WHERE id = ?`
    )
    .bind(id)
    .first<ImportRow>();

  return jsonBody(toImport(updated!));
}
