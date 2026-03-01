import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

type HouseholdRow = {
  id: string;
  agency_id: string;
  name: string;
  created_at: string;
};

function toHousehold(r: HouseholdRow) {
  return {
    id: r.id,
    agencyId: r.agency_id,
    name: r.name,
    createdAt: r.created_at
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

  const rows = await db
    .prepare(
      "SELECT id, agency_id, name, created_at FROM households WHERE agency_id = ? ORDER BY name ASC"
    )
    .bind(result.agency_id)
    .all<HouseholdRow>();

  const households = (rows.results ?? []).map(toHousehold);
  return jsonBody({ households });
}

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return jsonError("name is required", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const existing = await db
    .prepare(
      "SELECT id FROM households WHERE agency_id = ? AND name = ? LIMIT 1"
    )
    .bind(result.agency_id, name)
    .first<{ id: string }>();

  if (existing) {
    return jsonError("A household with this name already exists", "conflict", 409);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO households (id, agency_id, name, created_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .bind(id, result.agency_id, name)
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "household",
    entityId: id,
    action: "create",
    metadata: { name }
  });

  const row = await db
    .prepare(
      "SELECT id, agency_id, name, created_at FROM households WHERE id = ?"
    )
    .bind(id)
    .first<HouseholdRow>();

  return jsonBody(toHousehold(row!), { status: 201 });
}
