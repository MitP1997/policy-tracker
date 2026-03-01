# Security Analysis Report — Policy Tracker (Next.js)

**Scope:** Next.js App Router codebase; server vs client boundary; auth, APIs, and data handling.  
**Generated:** 2025-03-01

---

## Executive summary

- **Server/client boundary:** Backend code (DB, auth, R2, Cloudflare context) is correctly limited to server/API; no sensitive logic was found in client bundles.
- **Issues found:** Several medium- and lower-severity items: open redirect after login, missing rate limiting on OTP, possible path traversal and header injection in document handling, and a few hardening opportunities.

---

## 1. Server vs client (Next.js)

### 1.1 Backend-only code stays on server

- **`getDb()` / `getBucket()`** — Used only in:
  - API route handlers under `src/app/api/**`
  - Server Component `src/app/dashboard/page.tsx` (no `"use client"`)
- **Auth** — `getSession`, `getSessionFromRequest`, `requireAuth`, `requireOwner`, `verifyAccessToken`, `createAccessToken`, etc. are only used in API routes and the dashboard Server Component.
- **Secrets** — `AUTH_SECRET` / `JWT_SECRET` are read in `src/lib/auth/tokens.ts`, which is only imported by API routes, auth routes, and middleware (all server/edge). No `NEXT_PUBLIC_*` usage for secrets.

**Conclusion:** Backend-related code is not executed on the client; no server-only code was found in client components.

### 1.2 Client components

All `"use client"` components use only:

- `fetch()` to app API routes
- React hooks, `useRouter`, `useSearchParams`
- Shared pure helpers from `@/lib/imports` (types, `parsePremiumToPaise`, `IMPORT_CHUNK_SIZE`) which do not touch DB or env

**Conclusion:** Client components do not import server-only modules (db, auth, r2, Cloudflare context).

### 1.3 Recommendation

- Add a **server-only** guard so that `@/lib/db`, `@/lib/auth/tokens`, `@/lib/r2` (and any future server-only libs) cannot be imported from client code by mistake:
  - Install `server-only` and add `import "server-only"` at the top of those modules.

---

## 2. Authentication and session

### 2.1 Middleware and API auth

- Middleware protects **page** routes (redirects to `/login` when no valid access token).
- **API routes** are intentionally public in the matcher; each protected API uses `requireAuth()` or `requireOwner()` and returns 401/403 when appropriate.
- Cookies: access/refresh token cookie names are not secret; no sensitive data is stored in client-visible cookies.

### 2.2 Token and secret handling

- JWT creation/verification uses `AUTH_SECRET` or `JWT_SECRET` with a minimum length check (32 chars) in `src/lib/auth/tokens.ts`.
- **Risk:** If `AUTH_SECRET`/`JWT_SECRET` is missing in the Edge (middleware), `verifyAccessToken` → `getSecret()` can throw and break all protected page requests. Ensure these env vars are set in the Edge runtime (e.g. Cloudflare / OpenNext config).

### 2.3 Open redirect after login (medium)

**Location:** `src/app/login/page.tsx`

```ts
const from = searchParams.get("from") ?? "/";
// ...
router.push(from);
```

**Issue:** The `from` query parameter is used as-is for post-login redirect. An attacker can send a link like:

`/login?from=https://evil.com`

After a successful login, the user is sent to the external site.

**Recommendation:** Treat `from` as an allowed **relative path** only:

- Allow only strings that start with `/` and do not start with `//` (no protocol-relative or absolute URLs).
- Optionally allow only pathnames that belong to your app (e.g. allowlist or prefix like `/dashboard`, `/policies`, etc.).

Example:

```ts
function safeRedirectPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  try {
    new URL(path, "http://localhost");
    return path;
  } catch {
    return "/";
  }
}
const from = safeRedirectPath(searchParams.get("from"));
```

---

## 3. API and authorization

### 3.1 Authorization checks

- **Policies:** Scoped by `agency_id` and `canAccessPolicy(session, policy)` (owner vs staff).
- **Clients, users, imports, reminders, documents:** All scoped by `agency_id` (and, where relevant, `assigned_to` for staff).
- Document access uses `canAccessDocument()`; upload uses `canCreateDocumentForClientPolicy()` and validates `storageKey` prefix.

No missing auth or obvious IDOR was found in the reviewed routes.

### 3.2 Document upload — path traversal (low–medium)

**Location:** `src/app/api/documents/upload/route.ts`

**Current check:** `key.startsWith(\`${result.agency_id}/\`)`

**Issue:** A key like `agency-id/../other-agency/uuid` still starts with `agency_id/`. Depending on how R2 resolves keys, this could write outside the intended agency prefix.

**Recommendation:**

- Reject any `storageKey` containing `..` or more than one path segment after the agency prefix (e.g. exactly `{agency_id}/{uuid}`).
- Optionally validate that the second segment is a UUID v4 if that’s the only format you issue from `upload-url`.

### 3.3 Document download — header injection (low)

**Location:** `src/app/api/documents/[id]/download/route.ts`

```ts
const disposition = `attachment; filename="${filename.replace(/"/g, '\\"')}"`;
```

**Issue:** If `row.file_name` from the DB contains `\r` or `\n`, the header can be split, leading to HTTP response header injection.

**Recommendation:** Sanitize `filename` by removing or replacing any character that is not safe in a quoted header (e.g. strip or replace `\r`, `\n`, and `"`).

---

## 4. Rate limiting and abuse

### 4.1 OTP request (medium)

**Location:** `src/app/api/auth/request-otp/route.ts`

**Issue:** There is no rate limiting (comment: “Rate limit: placeholder”). This allows:

- Brute-force or abuse of the OTP endpoint (e.g. SMS bombing if WhatsApp is wired).
- Enumeration of phone numbers if responses differ.

**Recommendation:**

- Add rate limiting per IP and per phone number (e.g. max N requests per 15 minutes per number, and per IP).
- Use a consistent, generic message for invalid/missing number to avoid enumeration (you already return generic errors in many cases; keep that pattern).

---

## 5. Input validation and injection

### 5.1 SQL

- Queries use parameterized statements (`.prepare().bind()`) and fixed column names in application code. No user input is concatenated into SQL.  
**Conclusion:** No SQL injection issues identified.

### 5.2 Policies GET filter

**Location:** `src/app/api/policies/route.ts`

Query parameters (`status`, `assigned_to`, etc.) are passed only as bound parameters. Status is not restricted to the allowed enum in the GET handler; it only affects which rows match. No injection risk; you may still want to validate `status` against `policyStatusValues` for consistency and to avoid leaking “invalid” as a filter.

---

## 6. Sensitive data and logging

### 6.1 OTP and WhatsApp

- **`src/lib/whatsapp.ts`:** `sendOtpViaWhatsApp` logs OTP to console (`console.log("[OTP]", toNumber, code)`). In production this can expose OTPs in logs.

**Recommendation:** Remove or guard OTP/code logging (e.g. only in development, or never log the code).

### 6.2 Error responses

- API routes use `jsonError()` with generic messages; no stack traces or internal details are returned to the client.  
**Conclusion:** Appropriate for production.

---

## 7. Cookie and transport security

- Cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` in production (`process.env.NODE_ENV === "production"`).  
**Conclusion:** Aligned with good practices.

---

## 8. Checklist summary

| Area                    | Status | Notes                                                                 |
|-------------------------|--------|-----------------------------------------------------------------------|
| Server-only code on server | OK     | DB, auth, R2, env only on server/API                                  |
| No secrets in client   | OK     | No `NEXT_PUBLIC_*` for secrets; tokens in HttpOnly cookies            |
| Auth on protected APIs | OK     | requireAuth/requireOwner and agency/assignment checks                  |
| Open redirect          | Fix    | Validate `from` on login (relative path only)                         |
| OTP rate limiting       | Fix    | Add per-IP and per-number limits                                      |
| Document upload path   | Harden | Reject `..` and enforce format for `storageKey`                       |
| Document download header | Harden | Sanitize `filename` (CR/LF and quotes)                                |
| OTP in logs             | Harden | Avoid logging OTP/code in production                                  |
| server-only guard       | Optional | Add `server-only` to server-only libs                                |

---

## 9. Recommended next steps

1. **High:** Fix open redirect in login (`from` parameter).
2. **High:** Add rate limiting for `/api/auth/request-otp`.
3. **Medium:** Harden document upload `storageKey` (path traversal).
4. **Medium:** Sanitize `Content-Disposition` filename in document download.
5. **Low:** Stop logging OTP/code in production (or remove entirely).
6. **Low:** Add `import "server-only"` to `@/lib/db`, `@/lib/auth/tokens`, `@/lib/r2` (and any other server-only modules).

If you want, the next step can be concrete code changes for items 1–5 (and the `server-only` imports for item 6).
