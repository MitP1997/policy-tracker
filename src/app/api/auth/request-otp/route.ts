import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { isValidE164, normalizeE164 } from "@/lib/auth/constants";
import { sendOtpViaWhatsApp } from "@/lib/whatsapp";

const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request): Promise<Response> {
  let body: { whatsapp_number?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const raw = body.whatsapp_number;
  if (typeof raw !== "string" || !raw.trim()) {
    return jsonError("whatsapp_number is required", "validation", 400);
  }

  const whatsapp_number = normalizeE164(raw.trim());
  if (!isValidE164(whatsapp_number)) {
    return jsonError("Invalid E.164 phone number", "validation", 400);
  }

  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  // Rate limit: placeholder (per-number limit could use D1 or in-memory)
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  try {
    await db
      .prepare(
        "INSERT INTO otp_codes (phone, code, expires_at, created_at) VALUES (?, ?, ?, datetime('now'))"
      )
      .bind(whatsapp_number, code, expiresAt)
      .run();
  } catch (e) {
    console.error("otp_codes insert failed", e);
    return jsonError("DB not available", "unavailable", 503);
  }

  await sendOtpViaWhatsApp(whatsapp_number, code);

  return jsonBody({ ok: true });
}
