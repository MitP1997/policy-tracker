import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { canCreateDocumentForClientPolicy } from "@/lib/documents";

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let body: {
    clientId?: string | null;
    policyId?: string | null;
    docType?: string;
    fileName?: string;
    mimeType?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const clientId =
    body.clientId !== undefined
      ? (typeof body.clientId === "string" ? body.clientId.trim() : null)
      : undefined;
  const policyId =
    body.policyId !== undefined
      ? (typeof body.policyId === "string" ? body.policyId.trim() : null)
      : undefined;

  const docType = typeof body.docType === "string" ? body.docType.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!docType) return jsonError("docType is required", "validation", 400);
  if (!fileName) return jsonError("fileName is required", "validation", 400);

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const access = await canCreateDocumentForClientPolicy(
    db,
    result,
    clientId ?? null,
    policyId ?? null
  );
  if (!access.ok) {
    return jsonError(access.error ?? "Forbidden", "forbidden", 403);
  }

  const storageKey = `${result.agency_id}/${crypto.randomUUID()}`;
  const uploadUrl = "/api/documents/upload";

  return jsonBody({ storageKey, uploadUrl });
}
