import "server-only";
import * as jose from "jose";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

export interface AccessPayload {
  user_id: string;
  agency_id: string;
  role: string;
  exp: number;
  iat: number;
}

export interface RefreshPayload {
  user_id: string;
  agency_id: string;
  role: string;
  type: "refresh";
  exp: number;
  iat: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET or JWT_SECRET (min 32 chars) required");
  }
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(payload: {
  user_id: string;
  agency_id: string;
  role: string;
}): Promise<string> {
  const secret = getSecret();
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

export async function createRefreshToken(payload: {
  user_id: string;
  agency_id: string;
  role: string;
}): Promise<string> {
  const secret = getSecret();
  return await new jose.SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string
): Promise<AccessPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret);
    if ((payload as unknown as RefreshPayload).type === "refresh") return null;
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret);
    if ((payload as unknown as RefreshPayload).type !== "refresh") return null;
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}
