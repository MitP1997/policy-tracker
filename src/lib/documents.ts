import type { Session } from "@/lib/auth/session";

/** Max document size in bytes (10 MB per TDD §11). */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export type DocumentRow = {
  id: string;
  agency_id: string;
  client_id: string | null;
  policy_id: string | null;
  doc_type: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_key: string;
  uploaded_by: string | null;
  created_at: string;
};

/**
 * Check if the current user can access this document.
 * Owner: any document in the agency.
 * Staff: document linked to a policy assigned to them, or (client-only doc) client has at least one policy assigned to them.
 */
export async function canAccessDocument(
  db: D1Database,
  session: Session,
  doc: DocumentRow
): Promise<boolean> {
  if (doc.agency_id !== session.agency_id) return false;
  if (session.role === "owner") return true;

  if (doc.policy_id) {
    const policy = await db
      .prepare("SELECT assigned_to FROM policies WHERE id = ? AND agency_id = ?")
      .bind(doc.policy_id, session.agency_id)
      .first<{ assigned_to: string | null }>();
    return policy?.assigned_to === session.user_id;
  }

  if (doc.client_id) {
    const assigned = await db
      .prepare(
        "SELECT 1 FROM policies WHERE client_id = ? AND agency_id = ? AND assigned_to = ? LIMIT 1"
      )
      .bind(doc.client_id, session.agency_id, session.user_id)
      .first();
    return !!assigned;
  }

  return false;
}

/**
 * Check if the user can create a document for the given client and/or policy.
 * At least one of clientId or policyId must be set.
 * Owner: any client/policy in agency. Staff: policy assigned to them or client has an assigned policy.
 */
export async function canCreateDocumentForClientPolicy(
  db: D1Database,
  session: Session,
  clientId: string | null | undefined,
  policyId: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  const hasClient = clientId && clientId.trim() !== "";
  const hasPolicy = policyId && policyId.trim() !== "";
  if (!hasClient && !hasPolicy) {
    return { ok: false, error: "At least one of clientId or policyId is required" };
  }

  if (session.role === "owner") {
    if (hasPolicy) {
      const policy = await db
        .prepare("SELECT id FROM policies WHERE id = ? AND agency_id = ?")
        .bind(policyId!.trim(), session.agency_id)
        .first();
      if (!policy) return { ok: false, error: "Policy not found or not in agency" };
    }
    if (hasClient) {
      const client = await db
        .prepare("SELECT id FROM clients WHERE id = ? AND agency_id = ?")
        .bind(clientId!.trim(), session.agency_id)
        .first();
      if (!client) return { ok: false, error: "Client not found or not in agency" };
    }
    return { ok: true };
  }

  // Staff
  if (hasPolicy) {
    const policy = await db
      .prepare(
        "SELECT id, assigned_to FROM policies WHERE id = ? AND agency_id = ?"
      )
      .bind(policyId!.trim(), session.agency_id)
      .first<{ id: string; assigned_to: string | null }>();
    if (!policy) return { ok: false, error: "Policy not found or not in agency" };
    if (policy.assigned_to !== session.user_id) {
      return { ok: false, error: "You do not have access to this policy" };
    }
    return { ok: true };
  }

  if (hasClient) {
    const client = await db
      .prepare("SELECT id FROM clients WHERE id = ? AND agency_id = ?")
      .bind(clientId!.trim(), session.agency_id)
      .first();
    if (!client) return { ok: false, error: "Client not found or not in agency" };
    const assigned = await db
      .prepare(
        "SELECT 1 FROM policies WHERE client_id = ? AND agency_id = ? AND assigned_to = ? LIMIT 1"
      )
      .bind(clientId!.trim(), session.agency_id, session.user_id)
      .first();
    if (!assigned) return { ok: false, error: "You do not have access to this client" };
    return { ok: true };
  }

  return { ok: false, error: "At least one of clientId or policyId is required" };
}
