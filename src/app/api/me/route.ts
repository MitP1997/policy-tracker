import { cookies } from "next/headers";
import { jsonBody, jsonError } from "@/lib/api/response";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return jsonError("Unauthorized", "unauthorized", 401);
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return jsonError("Invalid or expired token", "unauthorized", 401);
  }

  return jsonBody({
    user_id: payload.user_id,
    agency_id: payload.agency_id,
    role: payload.role
  });
}
