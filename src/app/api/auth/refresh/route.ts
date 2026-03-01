import { cookies } from "next/headers";
import { jsonBody, jsonError } from "@/lib/api/response";
import {
  createAccessToken,
  verifyRefreshToken
} from "@/lib/auth/tokens";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return jsonError("Missing refresh token", "unauthorized", 401);
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return jsonError("Invalid or expired refresh token", "unauthorized", 401);
  }

  let accessToken: string;
  try {
    accessToken = await createAccessToken({
      user_id: payload.user_id,
      agency_id: payload.agency_id,
      role: payload.role
    });
  } catch {
    return jsonError("Auth configuration error", "config", 503);
  }

  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `${ACCESS_TOKEN_COOKIE}=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );

  return jsonBody({ ok: true }, { status: 200, headers });
}
