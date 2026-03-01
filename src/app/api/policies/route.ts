import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { policyStatusValues } from "@/db/schema/policies";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
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

export async function GET(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || null;
  const assignedTo = url.searchParams.get("assigned_to")?.trim() || null;
  const clientId = url.searchParams.get("client_id")?.trim() || null;
  const endDateFrom = url.searchParams.get("end_date_from")?.trim() || null;
  const endDateTo = url.searchParams.get("end_date_to")?.trim() || null;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const conditions: string[] = ["p.agency_id = ?"];
  const bindValues: (string | number)[] = [result.agency_id];

  if (result.role === "staff") {
    conditions.push("p.assigned_to = ?");
    bindValues.push(result.user_id);
  }
  if (status) {
    conditions.push("p.status = ?");
    bindValues.push(status);
  }
  if (assignedTo) {
    conditions.push("p.assigned_to = ?");
    bindValues.push(assignedTo);
  }
  if (clientId) {
    conditions.push("p.client_id = ?");
    bindValues.push(clientId);
  }
  if (endDateFrom) {
    conditions.push("date(p.end_date) >= date(?)");
    bindValues.push(endDateFrom);
  }
  if (endDateTo) {
    conditions.push("date(p.end_date) <= date(?)");
    bindValues.push(endDateTo);
  }

  const where = conditions.join(" AND ");
  const countSql = `SELECT COUNT(*) as total FROM policies p WHERE ${where}`;
  const listSql = `SELECT p.id, p.agency_id, p.client_id, p.insurance_type, p.insurer_name, p.policy_number,
    p.start_date, p.end_date, p.premium_paise, p.status, p.assigned_to, p.notes,
    p.status_updated_at, p.status_updated_by, p.created_at, p.updated_at,
    c.full_name as client_full_name
    FROM policies p
    LEFT JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
    WHERE ${where}
    ORDER BY p.end_date ASC
    LIMIT ? OFFSET ?`;

  const countStmt = db.prepare(countSql).bind(...bindValues);
  const listStmt = db.prepare(listSql).bind(...bindValues, limit, offset);

  const [countResult, listResult] = await Promise.all([
    countStmt.first<{ total: number }>(),
    listStmt.all<PolicyWithClient>()
  ]);

  const total = countResult?.total ?? 0;
  const policies = (listResult.results ?? []).map(toPolicyWithClient);

  return jsonBody({ policies, total });
}

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

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

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const insuranceType = typeof body.insuranceType === "string" ? body.insuranceType.trim() : "";
  const insurerName = typeof body.insurerName === "string" ? body.insurerName.trim() : "";
  const endDate = parseDate(body.endDate);

  if (!clientId) return jsonError("clientId is required", "validation", 400);
  if (!insuranceType) return jsonError("insuranceType is required", "validation", 400);
  if (!insurerName) return jsonError("insurerName is required", "validation", 400);
  if (!endDate) return jsonError("endDate is required and must be YYYY-MM-DD", "validation", 400);

  const startDate = body.startDate != null ? parseDate(body.startDate) : null;
  const policyNumber =
    body.policyNumber === null || body.policyNumber === undefined
      ? null
      : typeof body.policyNumber === "string"
        ? body.policyNumber.trim() || null
        : null;

  let premiumPaise: number | null = null;
  if (body.premiumPaise !== undefined && body.premiumPaise !== null) {
    const n = Number(body.premiumPaise);
    if (!Number.isInteger(n) || n < 0) {
      return jsonError("premiumPaise must be a non-negative integer", "validation", 400);
    }
    premiumPaise = n;
  }

  const status =
    typeof body.status === "string" && policyStatusValues.includes(body.status as (typeof policyStatusValues)[number])
      ? (body.status as (typeof policyStatusValues)[number])
      : "active";

  let assignedTo: string | null = null;
  if (body.assignedTo !== undefined && body.assignedTo !== null && body.assignedTo !== "") {
    const raw = typeof body.assignedTo === "string" ? body.assignedTo.trim() : "";
    if (raw) {
      if (result.role === "staff" && raw !== result.user_id) {
        return jsonError("Staff can only assign policy to themselves", "validation", 400);
      }
      assignedTo = raw;
    }
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const client = await db
    .prepare("SELECT id FROM clients WHERE id = ? AND agency_id = ?")
    .bind(clientId, result.agency_id)
    .first<{ id: string }>();
  if (!client) {
    return jsonError("Client not found or not in agency", "validation", 400);
  }

  if (assignedTo) {
    const user = await db
      .prepare("SELECT id FROM users WHERE id = ? AND agency_id = ?")
      .bind(assignedTo, result.agency_id)
      .first<{ id: string }>();
    if (!user) {
      return jsonError("Assigned user not found or not in agency", "validation", 400);
    }
  }

  if (policyNumber) {
    const existing = await db
      .prepare(
        "SELECT 1 FROM policies WHERE agency_id = ? AND policy_number = ? LIMIT 1"
      )
      .bind(result.agency_id, policyNumber)
      .first();
    if (existing) {
      return jsonError("Policy number already exists in this agency", "conflict", 409);
    }
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO policies (
        id, agency_id, client_id, insurance_type, insurer_name, policy_number,
        start_date, end_date, premium_paise, status, assigned_to, notes,
        status_updated_at, status_updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, datetime('now'), datetime('now'))`
    )
    .bind(
      id,
      result.agency_id,
      clientId,
      insuranceType,
      insurerName,
      policyNumber,
      startDate,
      endDate,
      premiumPaise,
      status,
      assignedTo,
      notes
    )
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "policy",
    entityId: id,
    action: "create",
    metadata: { insuranceType, insurerName, endDate }
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

  return jsonBody(toPolicy(row!), { status: 201 });
}
