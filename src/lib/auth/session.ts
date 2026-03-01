import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { jsonError } from "@/lib/api/response";

export interface Session {
  user_id: string;
  agency_id: string;
  role: string;
}

/** Get session from cookies only. Use in Server Components (no Request). */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return {
    user_id: payload.user_id,
    agency_id: payload.agency_id,
    role: payload.role
  };
}

export async function getSessionFromRequest(
  request: Request
): Promise<Session | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return {
    user_id: payload.user_id,
    agency_id: payload.agency_id,
    role: payload.role
  };
}

export async function requireAuth(
  request: Request
): Promise<Session | Response> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return jsonError("Unauthorized", "unauthorized", 401);
  }
  return session;
}

export async function requireOwner(
  request: Request
): Promise<Session | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;
  if (result.role !== "owner") {
    return jsonError("Forbidden", "forbidden", 403);
  }
  return result;
}

export function canAccessPolicy(
  session: Session,
  policy: { assigned_to: string | null }
): boolean {
  if (session.role === "owner") return true;
  return policy.assigned_to === session.user_id;
}
