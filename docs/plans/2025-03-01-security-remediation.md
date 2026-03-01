# Security Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all findings from SECURITY-REPORT.md: open redirect, OTP rate limiting, document upload path traversal, document download header injection, OTP logging, and server-only guards.

**Architecture:** Fixes are localized to existing routes and libs; rate limiting uses a new D1 table and a small helper. No new infrastructure beyond D1.

**Tech Stack:** Next.js 16 App Router, D1 (Drizzle), existing auth/session patterns.

---

## Task 1: Fix open redirect after login

**Files:**
- Modify: `src/app/login/page.tsx`

**Step 1: Add safe redirect helper**

Add a function that only allows relative paths (starts with `/`, not `//`), and ensure the result is a single pathname (no protocol or host). Use it for the `from` value before `router.push(from)`.

**Step 2: Implement**

In `src/app/login/page.tsx`:

- Add a small helper (in the same file or in a shared util used only by this page):

```ts
/** Allow only same-origin relative paths for redirect; prevents open redirect. */
function safeRedirectPath(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  try {
    new URL(path, "http://localhost");
    return path;
  } catch {
    return "/";
  }
}
```

- Replace:

```ts
const from = searchParams.get("from") ?? "/";
```

with:

```ts
const from = safeRedirectPath(searchParams.get("from"));
```

**Step 3: Verify**

- Run `npm run typecheck` and `npm run lint`.
- Manually: open `/login?from=https://evil.com`, complete login; you should land on `/` (or `/dashboard` if that’s your default), not evil.com.
- Manually: `/login?from=/dashboard` then login; you should land on `/dashboard`.

**Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "fix(security): prevent open redirect via login 'from' parameter"
```

---

## Task 2: Add server-only guards to server-only modules

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/lib/db.ts`
- Modify: `src/lib/auth/tokens.ts`
- Modify: `src/lib/r2.ts`

**Step 1: Install server-only**

```bash
npm install server-only
```

**Step 2: Add guard to each server-only lib**

At the **top** of each file (before other imports), add:

- `src/lib/db.ts`: `import "server-only";`
- `src/lib/auth/tokens.ts`: `import "server-only";`
- `src/lib/r2.ts`: `import "server-only";`

**Step 3: Verify**

- Run `npm run typecheck` and `npm run lint`.
- Ensure no client component imports these (dashboard page and API routes are server-side).

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/db.ts src/lib/auth/tokens.ts src/lib/r2.ts
git commit -m "chore(security): add server-only guard to db, auth/tokens, r2"
```

---

## Task 3: Stop logging OTP/code in production

**Files:**
- Modify: `src/lib/whatsapp.ts`

**Step 1: Remove or guard OTP logging**

Replace the `console.log("[OTP]", toNumber, code)` in `sendOtpViaWhatsApp` with one of:

- **Option A (recommended):** Remove the log entirely.
- **Option B:** Guard so the code is never logged: e.g. only log in development and never log the code:  
  `if (process.env.NODE_ENV === "development") console.log("[OTP] sent to", toNumber);`

**Step 2: Verify**

- Run `npm run typecheck` and `npm run lint`.
- If Option B: run with NODE_ENV=production and confirm the code is not printed.

**Step 3: Commit**

```bash
git add src/lib/whatsapp.ts
git commit -m "fix(security): do not log OTP code in production"
```

---

## Task 4: Sanitize Content-Disposition filename (document download)

**Files:**
- Modify: `src/app/api/documents/[id]/download/route.ts`

**Step 1: Add safe filename helper**

Add a function that strips characters that can break headers (CR, LF, and double-quote), and use it for the `Content-Disposition` header.

Example:

```ts
/** Sanitize filename for Content-Disposition to prevent header injection (CR/LF/quote). */
function safeContentDispositionFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "").trim() || "download";
}
```

**Step 2: Use in download route**

Replace:

```ts
const filename = row.file_name || "download";
const disposition = `attachment; filename="${filename.replace(/"/g, '\\"')}"`;
```

with:

```ts
const filename = safeContentDispositionFilename(row.file_name || "download");
const disposition = `attachment; filename="${filename.replace(/"/g, '\\"')}"`;
```

**Step 3: Verify**

- Run `npm run typecheck` and `npm run lint`.
- Manually: upload a document, then (if you can) set its `file_name` in DB to contain `\r\n` or `"` and trigger download; response headers should not contain extra lines or broken syntax.

**Step 4: Commit**

```bash
git add src/app/api/documents/[id]/download/route.ts
git commit -m "fix(security): sanitize Content-Disposition filename to prevent header injection"
```

---

## Task 5: Harden document upload storageKey (path traversal)

**Files:**
- Modify: `src/app/api/documents/upload/route.ts`

**Step 1: Enforce storageKey format**

After the existing check `if (!key.startsWith(\`${result.agency_id}/\`))`:

- Reject if `key` contains `..`.
- Enforce that the key is exactly `{agency_id}/{uuid}` where the second segment is a UUID v4 (e.g. regex for UUID). This matches what `upload-url` returns.

Add:

```ts
if (key.includes("..")) {
  return jsonError("Invalid storageKey", "validation", 400);
}
const parts = key.split("/");
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (parts.length !== 2 || !uuidV4.test(parts[1] ?? "")) {
  return jsonError("Invalid storageKey format", "validation", 400);
}
```

**Step 3: Verify**

- Run `npm run typecheck` and `npm run lint`.
- Manually: obtain a valid upload URL, then call upload with `storageKey` set to `{agency_id}/../other/uuid` or `{agency_id}/not-a-uuid`; both should return 400.

**Step 3: Commit**

```bash
git add src/app/api/documents/upload/route.ts
git commit -m "fix(security): reject path traversal and enforce storageKey format in document upload"
```

---

## Task 6: Add OTP rate limiting (D1 table + helper)

**Files:**
- Create: `src/db/schema/otpRateLimit.ts`
- Modify: `src/db/schema/index.ts` (export new table)
- Create: `src/lib/auth/rate-limit-otp.ts` (helper that checks/incrs per key and window)
- Modify: `src/app/api/auth/request-otp/route.ts` (call helper with IP + phone, return 429 when over limit)

**Step 1: Create D1 schema for rate limit**

Create `src/db/schema/otpRateLimit.ts`:

- Table name: `otp_rate_limit` (or `otp_rate_limits`).
- Columns: `key` (text, primary or unique — e.g. "ip:1.2.3.4" or "phone:+123"); `count` (integer); `window_start` (text, ISO or same format as rest of app).
- Use Drizzle SQLite pattern consistent with `otpCodes.ts` (e.g. `sqliteTable`, `text`, `integer`).

**Step 2: Export from schema index**

In `src/db/schema/index.ts`, add:

```ts
export * from "./otpRateLimit";
```

**Step 3: Generate migration**

```bash
npm run db:generate
```

Then apply (or document for deploy):

```bash
npm run db:push
# or
npm run db:migrate
```

**Step 4: Implement rate limit helper**

Create `src/lib/auth/rate-limit-otp.ts`:

- Constants: e.g. `WINDOW_MINUTES = 15`, `MAX_PER_PHONE = 5`, `MAX_PER_IP = 10` (tune as needed).
- Function `checkAndIncrementOtpRateLimit(db: D1Database, key: string, limit: number): Promise<{ allowed: boolean }>`:
  - Key format: `phone:E164` or `ip:xxx`.
  - Use a fixed window: one row per key with `window_end` (ISO timestamp) and `count`. If now &gt; window_end, reset to new window (e.g. now + WINDOW_MINUTES) and count = 1. If count &gt;= limit, return `{ allowed: false }`. Else increment count and return `{ allowed: true }`.
  - Use parameterized D1 prepared statements only (no string concat).
  - Optional: delete rows where window_end &lt; now to keep table small (or run cleanup separately).

**Step 5: Use in request-otp route**

In `src/app/api/auth/request-otp/route.ts`:

- After validating `whatsapp_number`, get DB as you do now.
- Get client IP: e.g. `request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"`.
- Call `checkAndIncrementOtpRateLimit(db, "phone:" + whatsapp_number, MAX_PER_PHONE)` and `checkAndIncrementOtpRateLimit(db, "ip:" + ip, MAX_PER_IP)` (order: check phone first, then IP; if either disallows, return 429 with a generic message like "Too many attempts. Try again later.").
- Keep existing behavior when allowed (generate OTP, store, send).

**Step 6: Verify**

- Run `npm run typecheck` and `npm run lint`.
- Manually: hit `POST /api/auth/request-otp` with same body (or same IP) repeatedly; after N requests (e.g. 5 for same number or 10 per IP), expect 429 and no new OTP sent.

**Step 7: Commit**

```bash
git add src/db/schema/otpRateLimit.ts src/db/schema/index.ts src/lib/auth/rate-limit-otp.ts src/app/api/auth/request-otp/route.ts drizzle/
git commit -m "feat(security): add OTP rate limiting per phone and per IP via D1"
```

---

## Execution order

| Order | Task | Risk / dependency |
|-------|------|-------------------|
| 1 | Task 1: Open redirect | None |
| 2 | Task 2: server-only | None |
| 3 | Task 3: OTP logging | None |
| 4 | Task 4: Content-Disposition | None |
| 5 | Task 5: storageKey validation | None |
| 6 | Task 6: OTP rate limiting | Depends on D1 migration (db:generate + db:push/migrate) |

Tasks 1–5 can be done in any order after Task 1. Task 6 should be last so the schema and migration are applied before the route uses the new table.

---

## Verification checklist (before closing)

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] Login with `?from=https://evil.com` redirects to `/` (or safe default), not external.
- [ ] Login with `?from=/dashboard` redirects to `/dashboard`.
- [ ] Document download with malicious filename in DB does not inject headers.
- [ ] Document upload with `storageKey` containing `..` or non-UUID returns 400.
- [ ] OTP request returns 429 after configured limit (per phone and per IP).
- [ ] No OTP code appears in logs in production (or log removed).
- [ ] Importing `@/lib/db` or `@/lib/auth/tokens` or `@/lib/r2` from a `"use client"` component fails at build or runtime (server-only).

---

## Optional follow-ups (not in scope)

- Validate `status` in GET `/api/policies` against `policyStatusValues` for consistency.
- Document AUTH_SECRET/JWT_SECRET requirement for Edge (middleware) in README or env example.
