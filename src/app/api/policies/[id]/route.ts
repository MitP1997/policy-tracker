import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth, canAccessPolicy } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { policyStatusValues } from "@/db/schema/policies";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PolicyRow = {
  id: string;
  agency_id: string;
  client_id: string;
  insurance_type: string;
  insurer_name: string;
  policy_number: string | null;
  start_date: string | null;
  end_date: string;
  premium_paise: number | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type PolicyWithClient = PolicyRow & { client_full_name?: string };

function toPolicy(r: PolicyRow) {
  return {
    id: r.id,
    agencyId: r.agency_id,
    clientId: r.client_id,
    insuranceType: r.insurance_type,
    insurerName: r.insurer_name,
    policyNumber: r.policy_number,
    startDate: r.start_date,
    endDate: r.end_date,
    premiumPaise: r.premium_paise,
    status: r.status,
    assignedTo: r.assigned_to,
    notes: r.notes,
    statusUpdatedAt: r.status_updated_at,
    statusUpdatedBy: r.status_updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function toPolicyWithClient(r: PolicyWithClient) {
  return {
    ...toPolicy(r),
    clientFullName: r.client_full_name ?? undefined
  };
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id } = await params;
  if (!id) return jsonError("Policy id is required", "validation", 400);

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const row = await db
    .prepare(
      `SELECT p.id, p.agency_id, p.client_id, p.insurance_type, p.insurer_name, p.policy_number,
       p.start_date, p.end_date, p.premium_paise, p.status, p.assigned_to, p.notes,
       p.status_updated_at, p.status_updated_by, p.created_at, p.updated_at,
       c.full_name as client_full_name
       FROM policies p
       LEFT JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
       WHERE p.id = ? AND p.agency_id = ?`
    )
    .bind(id, result.agency_id)
    .first<PolicyWithClient>();

  if (!row) {
    return jsonError("Policy not found", "not_found", 404);
  }

  if (!canAccessPolicy(result, { assigned_to: row.assigned_to })) {
    return jsonError("Forbidden", "forbidden", 403);
  }

  return jsonBody(toPolicyWithClient(row));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id: policyId } = await params;
  if (!policyId) return jsonError("Policy id is required", "validation", 400);

  let body: {
    clientId?: string;
    insuranceType?: string;
    insurerName?: string;
    policyNumber?: string | null;
    startDate?: string | null;
    endDate?: string;
    premiumPaise?: number | null;
    status?: string;
    assignedTo?: string | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const existing = await db
    .prepare(
      `SELECT id, agency_id, client_id, insurance_type, insurer_name, policy_number,
       start_date, end_date, premium_paise, status, assigned_to, notes,
       status_updated_at, status_updated_by, created_at, updated_at
       FROM policies WHERE id = ? AND agency_id = ?`
    )
    .bind(policyId, result.agency_id)
    .first<PolicyRow>();

  if (!existing) {
    return jsonError("Policy not found", "not_found", 404);
  }

  if (!canAccessPolicy(result, { assigned_to: existing.assigned_to })) {
    return jsonError("Forbidden", "forbidden", 403);
  }

  if (body.clientId !== undefined) {
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) return jsonError("clientId cannot be empty", "validation", 400);
    const client = await db
      .prepare("SELECT id FROM clients WHERE id = ? AND agency_id = ?")
      .bind(clientId, result.agency_id)
      .first<{ id: string }>();
    if (!client) return jsonError("Client not found or not in agency", "validation", 400);
  }

  if (body.assignedTo !== undefined && body.assignedTo !== null && body.assignedTo !== "") {
    const raw = typeof body.assignedTo === "string" ? body.assignedTo.trim() : "";
    if (raw && result.role === "staff" && raw !== result.user_id) {
      return jsonError("Staff can only assign policy to themselves", "validation", 400);
    }
    if (raw) {
      const user = await db
        .prepare("SELECT id FROM users WHERE id = ? AND agency_id = ?")
        .bind(raw, result.agency_id)
        .first<{ id: string }>();
      if (!user) return jsonError("Assigned user not found or not in agency", "validation", 400);
    }
  }

  const policyNumber =
    body.policyNumber === null || body.policyNumber === undefined
      ? undefined
      : typeof body.policyNumber === "string"
        ? body.policyNumber.trim() || null
        : undefined;

  if (policyNumber !== undefined && policyNumber !== null) {
    const conflict = await db
      .prepare(
        "SELECT 1 FROM policies WHERE agency_id = ? AND policy_number = ? AND id != ? LIMIT 1"
      )
      .bind(result.agency_id, policyNumber, policyId)
      .first();
    if (conflict) {
      return jsonError("Policy number already exists in this agency", "conflict", 409);
    }
  }

  const updates: string[] = [];
  const bindValues: (string | number | null)[] = [];
  const metadata: Record<string, unknown> = {};

  if (body.clientId !== undefined) {
    const v = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!v) return jsonError("clientId cannot be empty", "validation", 400);
    updates.push("client_id = ?");
    bindValues.push(v);
    metadata.clientId = v;
  }
  if (body.insuranceType !== undefined) {
    const v = typeof body.insuranceType === "string" ? body.insuranceType.trim() : "";
    if (!v) return jsonError("insuranceType cannot be empty", "validation", 400);
    updates.push("insurance_type = ?");
    bindValues.push(v);
    metadata.insuranceType = v;
  }
  if (body.insurerName !== undefined) {
    const v = typeof body.insurerName === "string" ? body.insurerName.trim() : "";
    if (!v) return jsonError("insurerName cannot be empty", "validation", 400);
    updates.push("insurer_name = ?");
    bindValues.push(v);
    metadata.insurerName = v;
  }
  if (policyNumber !== undefined) {
    updates.push("policy_number = ?");
    bindValues.push(policyNumber);
    metadata.policyNumber = policyNumber;
  }
  if (body.startDate !== undefined) {
    const v = body.startDate == null ? null : parseDate(body.startDate);
    updates.push("start_date = ?");
    bindValues.push(v);
    metadata.startDate = v;
  }
  if (body.endDate !== undefined) {
    const v = parseDate(body.endDate);
    if (!v) return jsonError("endDate must be YYYY-MM-DD", "validation", 400);
    updates.push("end_date = ?");
    bindValues.push(v);
    metadata.endDate = v;
  }
  if (body.premiumPaise !== undefined) {
    const v =
      body.premiumPaise === null || body.premiumPaise === undefined
        ? null
        : Number(body.premiumPaise);
    if (v !== null && (!Number.isInteger(v) || v < 0)) {
      return jsonError("premiumPaise must be a non-negative integer", "validation", 400);
    }
    updates.push("premium_paise = ?");
    bindValues.push(v);
    metadata.premiumPaise = v;
  }
  if (body.status !== undefined) {
    const v =
      typeof body.status === "string" && policyStatusValues.includes(body.status as (typeof policyStatusValues)[number])
        ? body.status
        : null;
    if (!v) return jsonError("status must be one of: " + policyStatusValues.join(", "), "validation", 400);
    updates.push("status = ?");
    bindValues.push(v);
    metadata.status = v;
  }
  if (body.assignedTo !== undefined) {
    const v =
      body.assignedTo === null || body.assignedTo === ""
        ? null
        : typeof body.assignedTo === "string"
          ? body.assignedTo.trim() || null
          : null;
    updates.push("assigned_to = ?");
    bindValues.push(v);
    metadata.assignedTo = v;
  }
  if (body.notes !== undefined) {
    const v = typeof body.notes === "string" ? body.notes.trim() || null : null;
    updates.push("notes = ?");
    bindValues.push(v);
    metadata.notes = v;
  }

  if (updates.length === 0) {
    const row = await db
      .prepare(
        `SELECT p.id, p.agency_id, p.client_id, p.insurance_type, p.insurer_name, p.policy_number,
         p.start_date, p.end_date, p.premium_paise, p.status, p.assigned_to, p.notes,
         p.status_updated_at, p.status_updated_by, p.created_at, p.updated_at,
         c.full_name as client_full_name
         FROM policies p
         LEFT JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
         WHERE p.id = ?`
      )
      .bind(policyId)
      .first<PolicyWithClient>();
    return jsonBody(toPolicyWithClient(row!));
  }

  updates.push("updated_at = datetime('now')");
  bindValues.push(policyId);

  await db
    .prepare(`UPDATE policies SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...bindValues)
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "policy",
    entityId: policyId,
    action: "update",
    metadata: Object.keys(metadata).length ? metadata : undefined
  });

  const row = await db
    .prepare(
      `SELECT p.id, p.agency_id, p.client_id, p.insurance_type, p.insurer_name, p.policy_number,
       p.start_date, p.end_date, p.premium_paise, p.status, p.assigned_to, p.notes,
       p.status_updated_at, p.status_updated_by, p.created_at, p.updated_at,
       c.full_name as client_full_name
       FROM policies p
       LEFT JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
       WHERE p.id = ?`
    )
    .bind(policyId)
    .first<PolicyWithClient>();

  return jsonBody(toPolicyWithClient(row!));
}
