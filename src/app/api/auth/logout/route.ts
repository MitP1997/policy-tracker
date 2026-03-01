import { jsonBody } from "@/lib/api/response";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";

const CLEAR_COOKIE =
  "Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

export async function POST(): Promise<Response> {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `${ACCESS_TOKEN_COOKIE}=; ${CLEAR_COOKIE}`
  );
  headers.append(
    "Set-Cookie",
    `${REFRESH_TOKEN_COOKIE}=; ${CLEAR_COOKIE}`
  );
  return jsonBody({ ok: true }, { status: 200, headers });
}
