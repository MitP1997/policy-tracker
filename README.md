# Policy Tracker

## Phase 2 — Auth (OTP + session)

- **Login**: WhatsApp number (E.164) → request OTP → enter code → verify. OTP is sent via a skeleton (no real WhatsApp API yet); the code is **logged** so you can test E2E (check server logs for `[OTP] <number> <code>`).
- **Session**: Access token (short-lived) and refresh token (httpOnly cookies). Protected routes redirect to `/login` when unauthenticated.

### Setup

1. **Secrets**  
   Copy `.env.example` to `.env.local` and set `AUTH_SECRET` (min 32 characters) for JWT signing.

2. **D1 migrations (Drizzle Kit)**  
   Same setup as the godizzy codebase: Drizzle Kit talks to D1 via the HTTP API. Set in `.env`: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_TOKEN`, `D1_DATABASE_ID` (use `database_id` from `wrangler.jsonc`).
   - **Generate** (after schema changes): `npm run db:generate` — writes SQL to `drizzle/`.
   - **Apply** (runs against D1 specified by env): `npm run db:migrate` — applies pending migrations via D1 HTTP API.
   - **Push** (sync schema without migration files): `npm run db:push`.
   - **Studio**: `npm run db:studio` — open Drizzle Studio against the same D1.

   To apply migrations to **local** D1 (e.g. `.wrangler/state`), use Wrangler directly:  
   `npx wrangler d1 execute policy-tracker-local --local --file=./drizzle/0000_*.sql` (and any newer `drizzle/*.sql` in order).

3. **Run**  
   `npm run dev`. For full E2E with D1 and bindings, use your project’s Cloudflare Workers dev flow (e.g. `wrangler dev` with the Next.js adapter when configured).

### API

- `POST /api/auth/request-otp` — body: `{ whatsapp_number }` (E.164)
- `POST /api/auth/verify-otp` — body: `{ whatsapp_number, code }` → sets cookies, returns user
- `POST /api/auth/refresh` — refresh token from cookie → new access token
- `POST /api/auth/logout` — clears auth cookies
- `GET /api/me` — current user (requires access token)
