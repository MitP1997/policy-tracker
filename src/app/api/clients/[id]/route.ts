import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

type ClientRow = {
  id: string;
  agency_id: string;
  full_name: string;
  phone: string | null;
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
    email: r.email,
    address: r.address,
    notes: r.notes,
    householdId: r.household_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id } = await params;
  if (!id) {
    return jsonError("Client id is required", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const row = await db
    .prepare(
      `SELECT id, agency_id, full_name, phone, email, address, notes, household_id, created_by, created_at, updated_at
       FROM clients WHERE id = ? AND agency_id = ?`
    )
    .bind(id, result.agency_id)
    .first<ClientRow>();

  if (!row) {
    return jsonError("Client not found", "not_found", 404);
  }

  return jsonBody(toClient(row));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id: clientId } = await params;
  if (!clientId) {
    return jsonError("Client id is required", "validation", 400);
  }

  let body: {
    fullName?: string;
    phone?: string;
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

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const existing = await db
    .prepare(
      `SELECT id, agency_id, full_name, phone, email, address, notes, household_id
       FROM clients WHERE id = ? AND agency_id = ?`
    )
    .bind(clientId, result.agency_id)
    .first<ClientRow>();

  if (!existing) {
    return jsonError("Client not found", "not_found", 404);
  }

  if (body.householdId !== undefined && body.householdId !== null) {
    const householdId = typeof body.householdId === "string" ? body.householdId.trim() : "";
    if (householdId) {
      const household = await db
        .prepare("SELECT id FROM households WHERE id = ? AND agency_id = ?")
        .bind(householdId, result.agency_id)
        .first<{ id: string }>();
      if (!household) {
        return jsonError("Household not found or not in agency", "validation", 400);
      }
    }
  }

  const updates: string[] = [];
  const bindValues: (string | null)[] = [];
  const metadata: Record<string, unknown> = {};

  if (body.fullName !== undefined) {
    const v = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (!v) {
      return jsonError("fullName cannot be empty", "validation", 400);
    }
    updates.push("full_name = ?");
    bindValues.push(v);
    metadata.fullName = v;
  }
  if (body.phone !== undefined) {
    const v = typeof body.phone === "string" ? body.phone.trim() || null : null;
    updates.push("phone = ?");
    bindValues.push(v);
    metadata.phone = v;
  }
  if (body.email !== undefined) {
    const v = typeof body.email === "string" ? body.email.trim() || null : null;
    updates.push("email = ?");
    bindValues.push(v);
    metadata.email = v;
  }
  if (body.address !== undefined) {
    const v = typeof body.address === "string" ? body.address.trim() || null : null;
    updates.push("address = ?");
    bindValues.push(v);
    metadata.address = v;
  }
  if (body.notes !== undefined) {
    const v = typeof body.notes === "string" ? body.notes.trim() || null : null;
    updates.push("notes = ?");
    bindValues.push(v);
    metadata.notes = v;
  }
  if (body.householdId !== undefined) {
    const v =
      body.householdId === null || body.householdId === ""
        ? null
        : typeof body.householdId === "string"
          ? body.householdId.trim() || null
          : null;
    updates.push("household_id = ?");
    bindValues.push(v);
    metadata.householdId = v;
  }

  if (updates.length === 0) {
    const row = await db
      .prepare(
        `SELECT id, agency_id, full_name, phone, email, address, notes, household_id, created_by, created_at, updated_at
         FROM clients WHERE id = ?`
      )
      .bind(clientId)
      .first<ClientRow>();
    return jsonBody(toClient(row!));
  }

  updates.push("updated_at = datetime('now')");
  bindValues.push(clientId);

  await db
    .prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...bindValues)
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "client",
    entityId: clientId,
    action: "update",
    metadata: Object.keys(metadata).length ? metadata : undefined
  });

  const row = await db
    .prepare(
      `SELECT id, agency_id, full_name, phone, email, address, notes, household_id, created_by, created_at, updated_at
       FROM clients WHERE id = ?`
    )
    .bind(clientId)
    .first<ClientRow>();

  return jsonBody(toClient(row!));
}
