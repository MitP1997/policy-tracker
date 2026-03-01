import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth, canAccessPolicy } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { policyStatusValues } from "@/db/schema/policies";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id } = await params;
  if (!id) return jsonError("Policy id is required", "validation", 400);

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!status || !policyStatusValues.includes(status as (typeof policyStatusValues)[number])) {
    return jsonError(
      "status is required and must be one of: " + policyStatusValues.join(", "),
      "validation",
      400
    );
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const existing = await db
    .prepare(
      `SELECT p.id, p.agency_id, p.client_id, p.insurance_type, p.insurer_name, p.policy_number,
       p.start_date, p.end_date, p.premium_paise, p.status, p.assigned_to, p.notes,
       p.status_updated_at, p.status_updated_by, p.created_at, p.updated_at
       FROM policies p WHERE p.id = ? AND p.agency_id = ?`
    )
    .bind(id, result.agency_id)
    .first<PolicyRow>();

  if (!existing) {
    return jsonError("Policy not found", "not_found", 404);
  }

  if (!canAccessPolicy(result, { assigned_to: existing.assigned_to })) {
    return jsonError("Forbidden", "forbidden", 403);
  }

  const previousStatus = existing.status;

  await db
    .prepare(
      `UPDATE policies SET status = ?, status_updated_at = datetime('now'), status_updated_by = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(status, result.user_id, id)
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "policy",
    entityId: id,
    action: "update",
    metadata: { statusChange: true, status, previousStatus }
  });

  const row = await db
    .prepare(
      `SELECT id, agency_id, client_id, insurance_type, insurer_name, policy_number,
       start_date, end_date, premium_paise, status, assigned_to, notes,
       status_updated_at, status_updated_by, created_at, updated_at
       FROM policies WHERE id = ?`
    )
    .bind(id)
    .first<PolicyRow>();

  return jsonBody(toPolicy(row!));
}
