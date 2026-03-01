import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireOwner } from "@/lib/auth/session";
import { isValidE164, normalizeE164 } from "@/lib/auth/constants";
import { writeAuditLog } from "@/lib/audit";

type UserRow = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
};

export async function GET(request: Request): Promise<Response> {
  const result = await requireOwner(request);
  if (result instanceof Response) return result;

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const rows = await db
    .prepare(
      "SELECT id, name, phone, role, status, last_login_at, created_at FROM users WHERE agency_id = ? ORDER BY created_at DESC"
    )
    .bind(result.agency_id)
    .all<UserRow>();

  const users = (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    role: r.role,
    status: r.status,
    last_login_at: r.last_login_at,
    created_at: r.created_at
  }));

  return jsonBody({ users });
}

export async function POST(request: Request): Promise<Response> {
  const result = await requireOwner(request);
  if (result instanceof Response) return result;

  let body: { name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name) {
    return jsonError("name is required", "validation", 400);
  }
  if (!rawPhone) {
    return jsonError("phone is required", "validation", 400);
  }

  const phone = normalizeE164(rawPhone);
  if (!isValidE164(phone)) {
    return jsonError("Invalid E.164 phone number", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const existing = await db
    .prepare(
      "SELECT id FROM users WHERE agency_id = ? AND phone = ? LIMIT 1"
    )
    .bind(result.agency_id, phone)
    .first<{ id: string }>();

  if (existing) {
    return jsonError("User with this phone already exists", "conflict", 409);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO users (id, agency_id, name, phone, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'staff', 'active', datetime('now'), datetime('now'))"
    )
    .bind(id, result.agency_id, name, phone)
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "user",
    entityId: id,
    action: "create",
    metadata: { name, role: "staff" }
  });

  return jsonBody(
    { id, name, phone, role: "staff", status: "active" },
    { status: 201 }
  );
}
