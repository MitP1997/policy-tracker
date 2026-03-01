import { getDb } from "@/lib/db";
import { getBucket } from "@/lib/r2";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  canCreateDocumentForClientPolicy,
  type DocumentRow
} from "@/lib/documents";

function toDocument(d: DocumentRow) {
  return {
    id: d.id,
    agencyId: d.agency_id,
    clientId: d.client_id,
    policyId: d.policy_id,
    docType: d.doc_type,
    fileName: d.file_name,
    mimeType: d.mime_type,
    fileSize: d.file_size,
    storageKey: d.storage_key,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at
  };
}

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let body: {
    storageKey?: string;
    fileName?: string;
    mimeType?: string | null;
    fileSize?: number | null;
    docType?: string;
    clientId?: string | null;
    policyId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const storageKey = typeof body.storageKey === "string" ? body.storageKey.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const docType = typeof body.docType === "string" ? body.docType.trim() : "";
  const clientId =
    body.clientId !== undefined && body.clientId !== null
      ? (typeof body.clientId === "string" ? body.clientId.trim() || null : null)
      : null;
  const policyId =
    body.policyId !== undefined && body.policyId !== null
      ? (typeof body.policyId === "string" ? body.policyId.trim() || null : null)
      : null;

  if (!storageKey) return jsonError("storageKey is required", "validation", 400);
  if (!fileName) return jsonError("fileName is required", "validation", 400);
  if (!docType) return jsonError("docType is required", "validation", 400);
  if (!clientId && !policyId) {
    return jsonError("At least one of clientId or policyId is required", "validation", 400);
  }

  const fileSize =
    body.fileSize !== undefined && body.fileSize !== null
      ? Number(body.fileSize)
      : null;
  if (fileSize !== null && (!Number.isInteger(fileSize) || fileSize < 0)) {
    return jsonError("fileSize must be a non-negative integer", "validation", 400);
  }

  const mimeType =
    body.mimeType !== undefined && body.mimeType !== null
      ? (typeof body.mimeType === "string" ? body.mimeType.trim() || null : null)
      : null;

  if (!storageKey.startsWith(`${result.agency_id}/`)) {
    return jsonError("Invalid storageKey for this agency", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const access = await canCreateDocumentForClientPolicy(
    db,
    result,
    clientId,
    policyId
  );
  if (!access.ok) {
    return jsonError(access.error ?? "Forbidden", "forbidden", 403);
  }

  let bucket: R2Bucket;
  try {
    bucket = await getBucket();
  } catch {
    return jsonError("Storage not available", "unavailable", 503);
  }

  const head = await bucket.head(storageKey);
  if (!head) {
    return jsonError("Upload not found. Complete upload first.", "not_found", 404);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO documents (id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      result.agency_id,
      clientId,
      policyId,
      docType,
      fileName,
      mimeType,
      fileSize,
      storageKey,
      result.user_id
    )
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "document",
    entityId: id,
    action: "create"
  });

  const row = await db
    .prepare(
      `SELECT id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at
       FROM documents WHERE id = ?`
    )
    .bind(id)
    .first<DocumentRow>();

  return jsonBody(toDocument(row!), { status: 201 });
}

export async function GET(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id")?.trim() || null;
  const policyId = searchParams.get("policy_id")?.trim() || null;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  let rows: DocumentRow[];

  if (result.role === "owner") {
    let resultSet: { results?: DocumentRow[] };
    if (clientId && policyId) {
      resultSet = await db
        .prepare(
          `SELECT id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at
           FROM documents WHERE agency_id = ? AND client_id = ? AND policy_id = ? ORDER BY created_at DESC`
        )
        .bind(result.agency_id, clientId, policyId)
        .all<DocumentRow>();
    } else if (clientId) {
      resultSet = await db
        .prepare(
          `SELECT id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at
           FROM documents WHERE agency_id = ? AND client_id = ? ORDER BY created_at DESC`
        )
        .bind(result.agency_id, clientId)
        .all<DocumentRow>();
    } else if (policyId) {
      resultSet = await db
        .prepare(
          `SELECT id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at
           FROM documents WHERE agency_id = ? AND policy_id = ? ORDER BY created_at DESC`
        )
        .bind(result.agency_id, policyId)
        .all<DocumentRow>();
    } else {
      resultSet = await db
        .prepare(
          `SELECT id, agency_id, client_id, policy_id, doc_type, file_name, mime_type, file_size, storage_key, uploaded_by, created_at
           FROM documents WHERE agency_id = ? ORDER BY created_at DESC`
        )
        .bind(result.agency_id)
        .all<DocumentRow>();
    }
    rows = resultSet.results ?? [];
  } else {
    const staffSet = await db
      .prepare(
        `SELECT d.id, d.agency_id, d.client_id, d.policy_id, d.doc_type, d.file_name, d.mime_type, d.file_size, d.storage_key, d.uploaded_by, d.created_at
         FROM documents d
         LEFT JOIN policies p ON p.id = d.policy_id AND p.agency_id = d.agency_id
         WHERE d.agency_id = ?
           AND (
             (d.policy_id IS NOT NULL AND p.assigned_to = ?)
             OR (d.policy_id IS NULL AND d.client_id IN (SELECT client_id FROM policies WHERE agency_id = ? AND assigned_to = ?))
           )
         ORDER BY d.created_at DESC`
      )
      .bind(result.agency_id, result.user_id, result.agency_id, result.user_id)
      .all<DocumentRow>();

    const staffRows = staffSet.results ?? [];
    if (clientId || policyId) {
      rows = staffRows.filter((d) => {
        if (clientId && d.client_id !== clientId) return false;
        if (policyId && d.policy_id !== policyId) return false;
        return true;
      });
    } else {
      rows = staffRows;
    }
  }

  const list = rows.map(toDocument);
  return jsonBody({ documents: list });
}
