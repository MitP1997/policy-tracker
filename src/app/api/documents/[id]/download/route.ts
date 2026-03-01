import { getDb } from "@/lib/db";
import { getBucket } from "@/lib/r2";
import { jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { canAccessDocument, type DocumentRow } from "@/lib/documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id } = await params;
  if (!id) return jsonError("Document id is required", "validation", 400);

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const row = await db
    .prepare(
      `SELECT id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at
       FROM documents WHERE id = ? AND agency_id = ?`
    )
    .bind(id, result.agency_id)
    .first<DocumentRow>();

  if (!row) {
    return jsonError("Document not found", "not_found", 404);
  }

  const allowed = await canAccessDocument(db, result, row);
  if (!allowed) {
    return jsonError("Forbidden", "forbidden", 403);
  }

  let bucket: R2Bucket;
  try {
    bucket = await getBucket();
  } catch {
    return jsonError("Storage not available", "unavailable", 503);
  }

  const object = await bucket.get(row.storage_key);
  if (!object) {
    return jsonError("Document file not found", "not_found", 404);
  }

  /** Sanitize filename for Content-Disposition to prevent header injection (CR/LF/quote). */
  function safeContentDispositionFilename(name: string): string {
    return name.replace(/[\r\n"]/g, "").trim() || "download";
  }

  const contentType = row.mime_type || "application/octet-stream";
  const filename = safeContentDispositionFilename(row.file_name || "download");
  const disposition = `attachment; filename="${filename.replace(/"/g, '\\"')}"`;

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition
    }
  });
}
