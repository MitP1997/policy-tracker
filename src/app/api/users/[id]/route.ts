import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireOwner } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

const ROLES = ["owner", "staff"] as const;
const STATUSES = ["active", "disabled"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireOwner(request);
  if (result instanceof Response) return result;

  const { id: targetId } = await params;
  if (!targetId) {
    return jsonError("User id is required", "validation", 400);
  }

  let body: { role?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const role =
    body.role !== undefined
      ? (ROLES as readonly string[]).includes(body.role)
        ? body.role
        : undefined
      : undefined;
  const status =
    body.status !== undefined
      ? (STATUSES as readonly string[]).includes(body.status)
        ? body.status
        : undefined
      : undefined;

  if (role === undefined && status === undefined) {
    return jsonError("role or status is required", "validation", 400);
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const target = await db
    .prepare("SELECT id, agency_id, role, name, phone FROM users WHERE id = ?")
    .bind(targetId)
    .first<{ id: string; agency_id: string; role: string; name: string; phone: string }>();

  if (!target || target.agency_id !== result.agency_id) {
    return jsonError("User not found", "not_found", 404);
  }

  if (targetId === result.user_id) {
    if (status === "disabled" || (role !== undefined && role !== "owner")) {
      return jsonError(
        "Cannot change your own role or disable yourself",
        "forbidden",
        403
      );
    }
  }

  if (
    (role === "staff" || status === "disabled") &&
    target.role === "owner"
  ) {
    const ownerCount = await db
      .prepare(
        "SELECT COUNT(*) as n FROM users WHERE agency_id = ? AND role = 'owner' AND status = 'active'"
      )
      .bind(result.agency_id)
      .first<{ n: number }>();
    if (ownerCount && ownerCount.n <= 1) {
      return jsonError(
        "Cannot demote or disable the last owner",
        "validation",
        400
      );
    }
  }

  const updates: string[] = [];
  const bindValues: (string | number)[] = [];
  const metadata: Record<string, unknown> = {};

  if (role !== undefined) {
    updates.push("role = ?");
    bindValues.push(role);
    metadata.role = role;
  }
  if (status !== undefined) {
    updates.push("status = ?");
    bindValues.push(status);
    metadata.status = status;
  }

  updates.push("updated_at = datetime('now')");
  bindValues.push(targetId);

  await db
    .prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    )
    .bind(...bindValues)
    .run();

  await writeAuditLog(db, {
    agencyId: result.agency_id,
    actorUserId: result.user_id,
    entityType: "user",
    entityId: targetId,
    action: "update",
    metadata: Object.keys(metadata).length ? metadata : undefined
  });

  const updated = await db
    .prepare(
      "SELECT id, name, phone, role, status, last_login_at, created_at FROM users WHERE id = ?"
    )
    .bind(targetId)
    .first<{
      id: string;
      name: string;
      phone: string;
      role: string;
      status: string;
      last_login_at: string | null;
      created_at: string;
    }>();

  return jsonBody(updated!);
}
