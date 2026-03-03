import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type ClientRow = {
  id: string;
  agency_id: string;
  full_name: string;
  phone: string | null;
  calling_number: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  household_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toClient(r: ClientRow) {
  return {
    id: r.id,
    agencyId: r.agency_id,
    fullName: r.full_name,
    phone: r.phone,
    callingNumber: r.calling_number,
    email: r.email,
    address: r.address,
    notes: r.notes,
    householdId: r.household_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
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
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const searchPattern = q ? `%${q}%` : null;

  let countStmt;
  let listStmt;

  if (searchPattern) {
    countStmt = db
      .prepare(
        `SELECT COUNT(*) as total FROM clients
         WHERE agency_id = ? AND (full_name LIKE ? OR phone LIKE ? OR calling_number LIKE ? OR email LIKE ?)`
      )
      .bind(result.agency_id, searchPattern, searchPattern, searchPattern, searchPattern);
    listStmt = db
      .prepare(
        `SELECT id, agency_id, full_name, phone, calling_number, email, address, notes, household_id, created_by, created_at, updated_at
         FROM clients
         WHERE agency_id = ? AND (full_name LIKE ? OR phone LIKE ? OR calling_number LIKE ? OR email LIKE ?)
         ORDER BY full_name ASC
         LIMIT ? OFFSET ?`
      )
      .bind(result.agency_id, searchPattern, searchPattern, searchPattern, searchPattern, limit, offset);
  } else {
    countStmt = db
      .prepare("SELECT COUNT(*) as total FROM clients WHERE agency_id = ?")
      .bind(result.agency_id);
    listStmt = db
      .prepare(
        `SELECT id, agency_id, full_name, phone, calling_number, email, address, notes, household_id, created_by, created_at, updated_at
         FROM clients
         WHERE agency_id = ?
         ORDER BY full_name ASC
         LIMIT ? OFFSET ?`
      )
      .bind(result.agency_id, limit, offset);
  }

  const [countResult, listResult] = await Promise.all([
    countStmt.first<{ total: number }>(),
    listStmt.all<ClientRow>()
  ]);

  const total = countResult?.total ?? 0;
  const clients = (listResult.results ?? []).map(toClient);

  return jsonBody({ clients, total });
}

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let body: {
    fullName?: string;
    phone?: string;
    callingNumber?: string | null;
    email?: string;
    address?: string;
    notes?: string;
    householdId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) {
    return jsonError("fullName is required", "validation", 400);
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const callingNumber =
    body.callingNumber === undefined
      ? phone
      : typeof body.callingNumber === "string"
        ? body.callingNumber.trim() || null
        : null;
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const address = typeof body.address === "string" ? body.address.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const householdId =
    body.householdId === null || body.householdId === undefined
      ? null
      : typeof body.householdId === "string"
        ? body.householdId.trim() || null
        : null;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  if (householdId) {
    const household = await db
      .prepare("SELECT id FROM households WHERE id = ? AND agency_id = ?")
      .bind(householdId, result.agency_id)
      .first<{ id: string }>();
    if (!household) {
      return jsonError("Household not found or not in agency", "validation", 400);
    }
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO clients (id, agency_id, full_name, phone, calling_number, email, address, notes, household_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      id,
      result.agency_id,
      fullName,
      phone,
      callingNumber,
      email,
      address,
      notes,
      householdId,
      result.user_id
    )
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "client",
    entityId: id,
    action: "create",
    metadata: { fullName }
  });

  const row = await db
    .prepare(
      `SELECT id, agency_id, full_name, phone, calling_number, email, address, notes, household_id, created_by, created_at, updated_at
       FROM clients WHERE id = ?`
    )
    .bind(id)
    .first<ClientRow>();

  return jsonBody(toClient(row!), { status: 201 });
}
