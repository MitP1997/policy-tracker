import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { isValidE164, normalizeE164 } from "@/lib/auth/constants";
import {
  createAccessToken,
  createRefreshToken
} from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE
} from "@/lib/auth/constants";

export async function POST(request: Request): Promise<Response> {
  let body: { whatsapp_number?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const rawNumber = body.whatsapp_number;
  const code = body.code;
  if (typeof rawNumber !== "string" || !rawNumber.trim()) {
    return jsonError("whatsapp_number is required", "validation", 400);
  }
  if (typeof code !== "string" || !code.trim()) {
    return jsonError("code is required", "validation", 400);
  }

  const whatsapp_number = normalizeE164(rawNumber.trim());
  if (!isValidE164(whatsapp_number)) {
    return jsonError("Invalid E.164 phone number", "validation", 400);
  }

  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const now = new Date().toISOString();
  const row = await db
    .prepare(
      "SELECT code, expires_at FROM otp_codes WHERE phone = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(whatsapp_number, now)
    .first<{ code: string; expires_at: string }>();

  if (!row || row.code !== code.trim()) {
    return jsonError("Invalid or expired code", "invalid_otp", 401);
  }

  await db
    .prepare("DELETE FROM otp_codes WHERE phone = ?")
    .bind(whatsapp_number)
    .run();

  // Find user by phone (unique per agency; we take first match for login)
  const userRow = await db
    .prepare(
      "SELECT id, agency_id, role, name FROM users WHERE phone = ? AND status = 'active' LIMIT 1"
    )
    .bind(whatsapp_number)
    .first<{ id: string; agency_id: string; role: string; name: string }>();

  let userId: string;
  let agencyId: string;
  let role: string;
  let name: string;

  if (userRow) {
    userId = userRow.id;
    agencyId = userRow.agency_id;
    role = userRow.role;
    name = userRow.name;
    await db
      .prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
      .bind(userId)
      .run();
  } else {
    agencyId = crypto.randomUUID();
    userId = crypto.randomUUID();
    role = "owner";
    name = "Owner";
    await db
      .prepare(
        "INSERT INTO agencies (id, name, owner_user_id, timezone, status, created_at, updated_at) VALUES (?, ?, ?, 'Asia/Kolkata', 'active', datetime('now'), datetime('now'))"
      )
      .bind(agencyId, "Default", userId)
      .run();
    await db
      .prepare(
        "INSERT INTO users (id, agency_id, name, phone, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))"
      )
      .bind(userId, agencyId, name, whatsapp_number, role)
      .run();
  }

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = await createAccessToken({
      user_id: userId,
      agency_id: agencyId,
      role
    });
    refreshToken = await createRefreshToken({
      user_id: userId,
      agency_id: agencyId,
      role
    });
  } catch (e) {
    console.error("Token creation failed", e);
    return jsonError("Auth configuration error", "config", 503);
  }

  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `${ACCESS_TOKEN_COOKIE}=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  headers.set(
    "Set-Cookie",
    `${REFRESH_TOKEN_COOKIE}=${refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );

  return jsonBody(
    {
      user_id: userId,
      agency_id: agencyId,
      role,
      name
    },
    { status: 200, headers }
  );
}
