export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** E.164: optional +, then 1–15 digits */
const E164_REGEX = /^\+?[1-9]\d{1,14}$/;

export function isValidE164(value: string): boolean {
  const normalized = value.startsWith("+") ? value : `+${value}`;
  return E164_REGEX.test(normalized);
}

export function normalizeE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : value;
}
