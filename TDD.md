## Technical Design Document (TDD) — PolicyTracker (V1)

### Context
- **Source PRD**: `PRD.md` (V1 only; exclude future enhancements)
- **App framework**: Next.js (App Router)
- **Target runtime**: Next.js deployed on Cloudflare (Workers runtime; stateless)
- **Database**: Cloudflare D1 (SQLite)
- **File storage** (for V1 “Document Storage” + import uploads): Cloudflare R2

---

## 1) Goals (V1)

### Product outcomes supported by this design
- **Expiry dashboard** that answers “what should I work on today?”
- **CRUD** for agencies/users, clients (optionally households), policies
- **Renewal status tracking** (lightweight states) with assignees
- **Agent-side reminders** (in-app reminders/tasks), driven by configurable rules
- **Basic document storage** attached to clients/policies
- **Import** policies from CSV/Excel with mapping + row-level error feedback

### Explicit non-goals (must not be implemented in V1)
- Insurer integrations, payment collection, claim management
- Automated client reminders / bulk messaging to customers
- Commission tracking, analytics, multi-branch support

---

## 2) Architecture (Next.js + D1 + R2 + Cron Worker)

### High-level components
- **Next.js app** (UI + API):
  - App Router pages for dashboard and CRUD workflows
  - Route handlers / server actions for:
    - Auth/session, multi-tenant authorization
    - CRUD for clients, policies, documents, users
    - Dashboard queries (expiring buckets)
    - Import endpoints (batch ingestion + validation)
- **Cron Worker** (scheduled trigger, daily; separate from Next.js):
  - Generate **in-app reminders** for each agency/user according to reminder rules
  - Optionally auto-mark policies as `expired` when past end date (see §6.3)
- **D1 database**:
  - Multi-tenant relational store, scoped by `agency_id`
- **R2 bucket**:
  - Stores uploaded documents and (optionally) raw import files
  - D1 stores metadata + `storage_key`

### Why this fits V8 isolates
- No dependency on in-memory state; every request is self-contained
- Background work uses Cron triggers rather than long-running processes
- Import is **chunked** to keep CPU/time bounded per request

---

## 3) Multi-tenancy & Authorization Model

### Tenant boundary
- **Agency = tenant**.
- Every user belongs to exactly one agency.
- Every data row is scoped by `agency_id` (clients, policies, documents, reminders, imports, etc.).

### Roles (from PRD)
- **Owner**:
  - Full access within agency
  - Manage users + settings
  - View all policies and staff workloads/activity
- **Staff**:
  - View/manage assigned policies
  - Update renewal status
  - Add notes and documents

### Enforcement
- All queries include `WHERE agency_id = ?` and are parameterized.
- Staff endpoints apply additional constraints:
  - For policy list/dashboard: default to assigned policies; allow owner override.
  - For updates: staff can update only assigned policies (or owner can update any).

---

## 4) Authentication & Sessions (V1)

### Requirements implied by PRD
- Multiple users per agency, with roles (owner/staff)
- Owner can “manage users”

### V1 approach
- **WhatsApp number-based login with one-time code (OTP)** and **httpOnly cookie session**.
  - Avoids password storage complexity in V1
  - Works well in serverless (stateless session token)
  - OTP delivery is via WhatsApp (implementation uses WhatsApp Business API; specific vendor/provider can be decided during implementation)

### Session / token model
- **Access token**: short-lived signed token (e.g. JWT or HMAC) in cookie or `Authorization` header; payload: `user_id`, `agency_id`, `role`, `exp`. Verified on every protected request.
- **Refresh token**: longer-lived, httpOnly secure cookie; used only to obtain new access tokens via `POST /auth/refresh`; rotate on use (recommended). No server-side session store required if tokens are self-contained and refresh is stateless (e.g. signed refresh token).
- Expired access token → 401; client or middleware uses refresh token to get a new access token without re-entering OTP.

### Rate limiting
- Apply rate limiting to OTP send/verify routes (Workers built-in rate limiting primitives; throttle by IP and WhatsApp number).

---

## 5) Data Model (D1 / SQLite)

### Design principles
- Use `TEXT` IDs (UUID strings).
- Store dates as ISO strings:
  - `YYYY-MM-DD` for policy dates
  - `YYYY-MM-DDTHH:mm:ssZ` (or `datetime('now')`) for timestamps
- Avoid floats for money: store premium in **paise** as `INTEGER`.

### Tables (V1)
The schema proposal in `schema.md` is a good starting point; below is the **V1-trimmed** version (remove future-scope automation like outbound messaging).

#### `agencies`
- Tenant root (name, timezone, status, owner_user_id)

#### `users`
- Belongs to one agency
- `whatsapp_number` (TEXT, required; E.164 format recommended; unique per agency)
- `role`: `owner` | `staff`
- `status`: `active` | `disabled`

#### `households` (optional feature)
- Grouping container for clients in one household/family

#### `clients`
- Basic contact details + optional `household_id`

#### `policies`
- Belongs to agency and client
- Fields:
  - `insurance_type` (TEXT) — from PRD “Insurance type”
  - `insurer_name` (TEXT) — from PRD “Insurance company”
  - `policy_number` (TEXT, nullable but unique per agency when present)
  - `start_date` (TEXT, nullable)
  - `end_date` (TEXT, required)
  - `premium_paise` (INTEGER, nullable)
  - `status` (TEXT): `active`, `renewal_in_progress`, `renewed`, `lost`, `expired`
  - `assigned_to` (TEXT user id, nullable)
  - `notes` (TEXT, nullable)
  - `status_updated_at`, `status_updated_by` (to support “staff activity” visibility)

#### `documents`
- Links to `client_id` and/or `policy_id`
- Stores metadata and `storage_key` pointing to R2

#### `reminder_rules`
- Per-agency reminder offsets (e.g. 30/15/7/1 days before expiry)
- Channel is **in-app** only in V1 (no outbound automation)

#### `reminders` (in-app follow-ups)
- A generated reminder instance a user can “complete/dismiss”
- Fields:
  - `policy_id`, `client_id` (denormalized for easier display)
  - `due_on` (YYYY-MM-DD)
  - `assigned_to` (user id)
  - `status`: `open` | `done` | `dismissed`
  - `rule_days_before` (integer)

#### `imports` + `import_rows` (for onboarding)
- `imports`: one import job/session per agency
- `import_rows`: row-level validation status + errors for feedback

#### `audit_log`
- Required for “owner visibility across staff activity”
- Store entity changes (create/update/delete) with actor and timestamps

### Critical indexes
- `policies(agency_id, end_date, status)` for dashboard buckets
- `policies(agency_id, assigned_to, end_date)` for staff views
- `clients(agency_id, household_id)` for household grouping
- `documents(agency_id, policy_id, client_id, created_at DESC)` for retrieval
- `reminders(agency_id, assigned_to, status, due_on)` for daily view

---

## 6) Key Flows & Query Design

### 6.1 Expiry Dashboard (primary screen)

#### Buckets (from PRD)
- 0–7 days
- 8–30 days
- 31–60 days
- Already expired

#### Implementation approach
- Compute buckets at query time using `end_date` vs “today” in agency timezone.
- For correctness with SQLite string dates:
  - store `end_date` as `YYYY-MM-DD`
  - compare using SQLite `date(end_date)` and `date(?)`
- Sorting: ascending by `end_date` within each bucket.

#### Access rules
- Owner: all policies within agency
- Staff: only policies where `assigned_to = current_user_id`

### 6.2 Renewal status tracking
- Status transitions are permissive (light workflow):
  - `active` → `renewal_in_progress` → (`renewed` | `lost`)
  - `active` → `expired` (manual or automated; see below)
- Record `status_updated_at/by` and write an `audit_log` entry on updates.

### 6.3 “Expired” handling
Two options; pick one in implementation (both satisfy PRD):
- **Derived expiry**: keep status as-is and show “already expired” when `end_date < today`.
  - Pro: no cron updates, simplest
  - Con: PRD lists `Expired` as a status; UI needs to show “expired” bucket anyway
- **Materialized expiry** (recommended for clarity): daily cron marks policies past `end_date` as `expired` if currently `active`/`renewal_in_progress`.
  - Pro: status reflects reality, simpler filtering
  - Con: requires cron trigger

---

## 7) Reminders & Follow-ups (Agent-side)

### What “reminder” means in V1
- **In-app** reminder items (not client messages).
- The dashboard and reminders should drive daily work discipline.

### Generation strategy (Cron)
- Run daily per timezone (store `agency.timezone`; schedule at a fixed UTC time and compute local “today”).
- For each agency:
  - For each reminder rule (`days_before`):
    - Find policies where `end_date = today + days_before`
    - Create reminders for the policy’s assignee (or owner if unassigned), idempotently.

### Idempotency
- Unique constraint suggestion:
  - `(agency_id, policy_id, assigned_to, due_on, rule_days_before)`

---

## 8) Document Storage (Basic)

### Storage choice
- Use **R2** for document binaries; store metadata in D1 `documents`.

### Upload flow
- API issues a short-lived upload URL (or streams upload through Worker with size caps).
- Store `storage_key`, `file_name`, `mime_type`, `file_size`, `doc_type`, `uploaded_by`.

### Access control
- Only users in same agency can list/download.
- Staff: allowed for documents attached to assigned policies (and related client), owner can access all.

---

## 9) Import from Existing Data (CSV/Excel)

### Worker-friendly approach
- Do **parsing client-side** when possible to keep Worker CPU/bundle small:
  - Accept `.csv` directly
  - For `.xlsx`, the UI parses Excel in-browser and converts to rows (JSON) + mapping

### Mapping UX requirement (from PRD)
- User maps columns to required fields:
  - client name, phone/email (optional), insurer name, insurance type, policy number, start date (optional), end date, premium (optional), assignee (optional)

### API design for import
- `POST /imports` creates an import session (returns `import_id`)
- `POST /imports/:id/rows` accepts rows in chunks (e.g. 100–500 rows)
  - Validate each row; insert valid ones; persist invalid ones to `import_rows`
  - Return a summary (success/failed counts) + row-level errors
- `POST /imports/:id/commit` marks import complete

### Validation rules (V1)
- `client_full_name` required
- `end_date` required and must parse to `YYYY-MM-DD`
- `policy_number` optional but when present must be unique within agency
- `premium` optional; if provided, parse to paise integer

---

## 10) API Surface (V1)

### Implementation note (Next.js)
- All endpoints below are implemented as **Next.js Route Handlers** (and/or server actions) and should preserve the paths as documented.

### Auth
- `POST /auth/request-otp` (whatsapp_number) — send OTP via WhatsApp; rate limited
- `POST /auth/verify-otp` (whatsapp_number, code) → issues access token + refresh token (cookies and/or response body as chosen)
- `POST /auth/refresh` — accept refresh token (cookie); return new access token (and optionally rotate refresh token)
- `POST /auth/logout` — clear cookies; invalidate refresh token if server-side revocation is used
- `GET /me` (current user + agency + role)

### Agency & user management
- `POST /users` (owner only; create staff user / invite)
- `GET /users` (owner only)
- `PATCH /users/:id` (owner only: role/status)

### Clients & households
- `POST /clients`, `GET /clients`, `GET /clients/:id`, `PATCH /clients/:id`
- `POST /households`, `GET /households`

### Policies
- `POST /policies`
- `GET /policies` (filters: status, assigned_to, date range)
- `GET /policies/:id`
- `PATCH /policies/:id` (including assign, notes)
- `POST /policies/:id/status` (status updates; writes audit log)

### Dashboard
- `GET /dashboard/expiries?window_days=60`
  - Returns grouped buckets with policy + client summary and quick-action links payloads

### Reminders (in-app)
- `GET /reminders/today`
- `POST /reminders/:id/done`
- `POST /reminders/:id/dismiss`
- `GET /settings/reminder-rules`
- `PUT /settings/reminder-rules`

### Documents
- `POST /documents/upload-url` (get upload URL + storage key)
- `POST /documents` (create metadata record after upload)
- `GET /documents?policy_id=&client_id=`
- `GET /documents/:id/download` (returns signed R2 URL or streams)

### Import
- `POST /imports`
- `POST /imports/:id/rows`
- `GET /imports/:id` (status + counts)
- `GET /imports/:id/errors` (row-level error report)
- `POST /imports/:id/commit`

---

## 11) Operational Considerations (Cloudflare)

### D1 constraints
- Keep transactions small; avoid huge single-request writes.
- Use prepared statements; always bind params.
- Be conservative with schema migrations (SQLite `ALTER TABLE` limitations).

### Timezone handling
- Store `agency.timezone` (default `Asia/Kolkata`).
- Normalize comparisons by computing “today” for the agency and passing as a parameter to SQL.

### Limits & guardrails (V1)
- Maximum import rows per import (e.g. 10k) and per chunk (e.g. 500)
- Maximum document size (e.g. 10–25MB) and allowed mime types
- Pagination on list endpoints

### Observability
- Structured logs for:
  - auth events (no sensitive data)
  - import summaries
  - cron run summaries per agency
- Capture errors with request id and `agency_id`/`user_id` when available

---

## 12) Data Privacy & Security (V1)
- Store minimal PII required (name/phone/email/address).
- Ensure:
  - httpOnly, secure cookies
  - input validation on all write endpoints
  - strict tenant scoping in every query
  - R2 objects are private; access only via signed URLs or Worker-gated streaming
- Audit log for accountability and “owner visibility”.

---

## 13) Migration from `schema.md`

### Keep (V1-aligned)
- `agencies`, `users`, `households`, `clients`, `policies`, `documents`, `reminder_rules`, `imports`, `import_rows`, `audit_log`

### Modify for V1 simplicity
- Replace `insurers` and `policy_types` tables with `policies.insurer_name` and `policies.insurance_type` (TEXT).
  - Rationale: lowers complexity while meeting PRD requirements.

### Remove (future-scope / not required in PRD V1)
- `outbound_messages` (implies automated messaging)
- Optional: `renewal_events` (only add if you want a timeline UI in V1)
- Optional: generic `tasks` (replaced by purpose-built `reminders` table for V1)

---

## 14) Testing Strategy (TDD-level)

### Unit tests
- Date bucket logic for dashboard
- Validation/parsing for import rows (dates, premium, policy uniqueness behavior)
- Authorization rules (owner vs staff access)

### Integration tests
- D1 queries for dashboard and reminder generation
- Document upload metadata + access checks
- Cron reminder generation idempotency

---

## 15) Implementation Phases (dependency-driven)

### Phase 0 — Next.js + Cloudflare foundation (implemented)
- **Dependencies**: none
- **Status**: implemented
- **Deliverables**
  - Next.js app scaffolded (App Router) with a placeholder UI shell
  - Cloudflare deployment target wired up for the Next.js app (Workers runtime)
  - D1 database + binding configured for app runtime
  - R2 bucket + binding configured for app runtime
  - Separate Cron Worker created for scheduled work (reminders/expiry materialization), with D1 binding
  - Environment separation (dev/stage/prod) with separate D1/R2 resources
- **Ready when**
  - App loads locally and in a deployed environment
  - “Health” route responds (via Next.js route handler)
  - A scheduled trigger runs and logs once (no DB writes yet)

### Phase 1 — Database schema (V1) + migrations (shared by app + cron)
- **Dependencies**: Phase 0
- **Deliverables**
  - D1 schema implementing V1 tables:
    - `agencies`, `users`, `households` (optional), `clients`, `policies`, `documents`
    - `reminder_rules`, `reminders`
    - `imports`, `import_rows`
    - `audit_log`
  - Critical indexes for dashboard, reminders, and imports
  - A repeatable migration workflow suitable for CI and local dev
- **Ready when**
  - Schema applies cleanly to a new D1 DB
  - Seed script can create a sample agency + owner user + a few policies for dashboard testing

### Phase 2 — Auth/session + token management + WhatsApp login + tenant scoping (UI + API + Next.js middleware)
- **Dependencies**: Phase 1
- **Deliverables**
  - **WhatsApp number–based login**
    - `POST /auth/request-otp`: accept WhatsApp number (E.164), validate, send OTP via WhatsApp Business API (or configured provider), apply rate limiting by IP and number
    - `POST /auth/verify-otp`: accept WhatsApp number + OTP code; on success, create/lookup user (and agency), issue tokens and set cookies
    - User identity tied to `users.whatsapp_number`; new numbers create first-user/agency or link to existing agency per product rules
  - **Access token and refresh token management**
    - **Access token**: short-lived signed token (e.g. JWT or HMAC) containing `user_id`, `agency_id`, `role`, `exp`; used for API and server-side auth (cookie or `Authorization: Bearer` as chosen)
    - **Refresh token**: longer-lived, stored in httpOnly secure cookie; used only to obtain new access tokens; rotation on use (optional but recommended)
    - `POST /auth/refresh`: accept refresh token (from cookie); validate and issue new access token (and optionally new refresh token); enforce rate limiting
    - Token verification on each request; clear contract for expired access token (401) and invalid/expired refresh (re-login)
  - **Session / auth layer**
    - A single shared auth/tenant layer used by: route handlers (API), server actions, server-rendered pages (current user/agency)
    - Middleware that enforces authentication on protected routes, loads current user context, and refreshes access token when needed (e.g. using refresh cookie)
  - **Logout**
    - `POST /auth/logout`: clear session cookies and invalidate refresh token (if server-side revocation is used)
  - **Basic request validation + consistent error shape** (e.g. 401/403/422)
  - **Login UI**
    - Login page (unauthenticated users hitting protected routes are redirected here)
    - Step 1: WhatsApp number input (E.164), submit triggers `POST /auth/request-otp`; show rate-limit and validation errors
    - Step 2: OTP code input, submit triggers `POST /auth/verify-otp`; on success, set cookies and redirect to app (e.g. dashboard or home)
    - Client-side handling of 401 (e.g. trigger refresh or redirect to login when refresh fails)
    - Logout control (link/button) that calls `POST /auth/logout` and redirects to login
- **Ready when**
  - User can complete login via the UI (enter number → request OTP → enter code → verify → redirect with session)
  - Protected routes redirect unauthenticated users to the login page
  - Protected endpoints reject unauthenticated access and accept valid access token (or cookie)
  - Expired access token leads to 401; client/ middleware can use refresh token to obtain new access token without re-entering OTP
  - Owner vs staff permission checks are enforced centrally (not copy-pasted)
  - Rate limiting is applied to OTP and refresh endpoints

### Phase 3 — Agency + user management (owner workflows: UI + API)
- **Dependencies**: Phase 2
- **Deliverables**
  - Owner-only API: create/list/update users
  - Owner UI flows:
    - User list
    - Create/invite staff
    - Enable/disable staff
  - Staff status enable/disable
  - Audit log entries for user management changes
- **Ready when**
  - Owner can add a staff user and the staff can log in

### Phase 4 — Client management (+ households if included) (UI + API)
- **Dependencies**: Phase 2
- **Deliverables**
  - Client CRUD with tenant scoping (API + server actions)
  - Client pages (list/detail/create/edit)
  - Household CRUD/listing (if shipped in V1) and client association
  - Search/pagination for clients list
  - Audit log for create/update
- **Ready when**
  - Users can create clients and retrieve them reliably at scale (paged lists)

### Phase 5 — Policy management (core domain) (UI + API)
- **Dependencies**: Phase 4
- **Deliverables**
  - Policy CRUD including assignment, notes, premium, insurer/type fields
  - Status update endpoint (active / renewal_in_progress / renewed / lost / expired)
  - Staff access limited to assigned policies; owner access across agency
  - Audit log for policy creates/updates/status changes
  - Policy pages (list/detail/create/edit) with assignee selection (owner-only where relevant)
- **Ready when**
  - Staff can only update assigned policies
  - Policy number uniqueness is enforced (when present) per agency

### Phase 6 — Expiry dashboard (primary value surface) (UI + API)
- **Dependencies**: Phase 5
- **Deliverables**
  - Dashboard endpoint implementing PRD buckets (0–7, 8–30, 31–60, expired)
  - Sorting by urgency (earliest expiry first)
  - Staff vs owner dashboard views
  - Dashboard page that renders server-side for fast initial load and correct tenant scoping
- **Ready when**
  - A seeded dataset returns correct bucket counts and ordering
  - Performance is acceptable using the `policies(agency_id, end_date, status)` index

### Phase 7 — Document storage (R2 + D1 metadata) (UI + API)
- **Dependencies**: Phase 2 (auth), Phase 4/5 (entities)
- **Deliverables**
  - Upload URL (or streaming) endpoint and document metadata create endpoint
  - Document list/filter by client/policy
  - Download endpoint (signed URL or Worker-gated stream)
  - Access control: staff limited to assigned policies; owner has full agency access
  - UI for upload/list/download on client/policy detail screens
- **Ready when**
  - A document uploaded to R2 is retrievable via authorized download and blocked cross-tenant

### Phase 8 — Reminders (rules + daily view + cron generation) (UI + API + Cron)
- **Dependencies**: Phase 5 (policies/assignees), Phase 6 (date logic reuse)
- **Deliverables**
  - Reminder rules endpoints (get/set per agency)
  - “Today” reminders endpoint for users
  - UI for:
    - Viewing today’s reminders
    - Marking done/dismissed
    - Configuring reminder rules (owner-only)
  - Cron job:
    - Generates reminders idempotently from rules and policy expiry dates
    - (If chosen) materializes `expired` status daily (see §6.3)
- **Ready when**
  - Running cron twice does not duplicate reminders
  - A user sees expected reminders for policies matching rules

### Phase 9 — Import (critical onboarding) (UI + API)
- **Dependencies**: Phase 4 (clients), Phase 5 (policies), Phase 2 (auth)
- **Deliverables**
  - Import session endpoints (`/imports`, chunked `/rows`, `/commit`)
  - Row-level validation and error feedback persisted in `import_rows`
  - Idempotency and chunk retry safety (re-sending a chunk does not double-insert)
  - Recommended UI contract:
    - Browser parses `.xlsx` and sends normalized rows + mapping
    - Server accepts only normalized rows (keeps Worker lean)
  - Import UI:
    - Upload/select file
    - Column mapping
    - Progress + per-row error review
- **Ready when**
  - A realistic CSV/Excel dataset can be imported with clear per-row failures
  - Large imports succeed via chunking without request timeouts

