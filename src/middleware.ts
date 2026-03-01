import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE
} from "@/lib/auth/constants";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/auth/request-otp",
  "/api/auth/verify-otp",
  "/api/auth/refresh"
];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return true;
  }
  // API routes handle their own auth and return 401 when needed
  if (pathname.startsWith("/api/")) return true;
  return PUBLIC_PATHS.some(
    (p) => p === pathname || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", request.nextUrl.pathname);
    const res = NextResponse.redirect(login);
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    res.cookies.delete(REFRESH_TOKEN_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp)$).*)"]
};
