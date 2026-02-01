# Multi-tenant Insurance Renewals SaaS — Cloudflare D1 (SQLite) Schema (Agency = Tenant)

> Cloudflare D1 uses SQLite. This schema is adjusted for SQLite/D1 constraints:
> - Use `TEXT` IDs (store UUIDs as strings) instead of `uuid`
> - Use `INTEGER` for booleans (0/1)
> - Use `DATETIME` stored as ISO-8601 strings (SQLite convention)
> - No native `timestamptz`, `jsonb`, `numeric(12,2)` (use `REAL` or store money in paise as `INTEGER`)
> - `ALTER TABLE` is limited in SQLite (plan migrations accordingly)
> - Foreign key enforcement requires `PRAGMA foreign_keys = ON;` (enable in app on each connection)
> - Partial indexes are supported (SQLite 3.8+), D1 supports modern SQLite features; still keep schema conservative.

**Recommendation for money:** store amounts in **paise** as `INTEGER` (avoids float rounding).

---

## Core: agencies

```sql
CREATE TABLE agencies (
  id            TEXT PRIMARY KEY,        -- UUID string
  name          TEXT NOT NULL,
  owner_user_id TEXT,                    -- set after user creation
  phone         TEXT,
  email         TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  plan          TEXT NOT NULL DEFAULT 'free',
  status        TEXT NOT NULL DEFAULT 'active', -- active, suspended, canceled
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_agencies_status ON agencies(status);


CREATE TABLE users (
  id            TEXT PRIMARY KEY, -- UUID string
  agency_id     TEXT NOT NULL,

  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,

  role          TEXT NOT NULL DEFAULT 'owner', -- owner, admin, staff, readonly
  status        TEXT NOT NULL DEFAULT 'active',
  last_login_at TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_agency ON users(agency_id);
CREATE UNIQUE INDEX uq_users_agency_email ON users(agency_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX uq_users_agency_phone ON users(agency_id, phone) WHERE phone IS NOT NULL;

CREATE TABLE households (
  id         TEXT PRIMARY KEY,
  agency_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX idx_households_agency ON households(agency_id);
CREATE UNIQUE INDEX uq_households_agency_name ON households(agency_id, name);


CREATE TABLE clients (
  id           TEXT PRIMARY KEY,
  agency_id    TEXT NOT NULL,

  full_name    TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,

  household_id TEXT,
  created_by   TEXT,

  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_clients_agency ON clients(agency_id);
CREATE INDEX idx_clients_household ON clients(agency_id, household_id);

CREATE TABLE insurers (
  id         TEXT PRIMARY KEY,
  agency_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX idx_insurers_agency ON insurers(agency_id);
CREATE UNIQUE INDEX uq_insurers_agency_name ON insurers(agency_id, name);

CREATE TABLE policy_types (
  id         TEXT PRIMARY KEY,
  agency_id  TEXT NOT NULL,
  name       TEXT NOT NULL, -- life, health, motor, travel, home...
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX idx_policy_types_agency ON policy_types(agency_id);
CREATE UNIQUE INDEX uq_policy_types_agency_name ON policy_types(agency_id, name);

CREATE TABLE policies (
  id                     TEXT PRIMARY KEY,
  agency_id              TEXT NOT NULL,
  client_id              TEXT NOT NULL,

  policy_type_id         TEXT,
  insurer_id             TEXT,

  policy_number          TEXT,

  status                 TEXT NOT NULL DEFAULT 'active',
  -- active, renewal_in_progress, renewed, expired, lost, canceled

  start_date             TEXT,            -- YYYY-MM-DD
  end_date               TEXT NOT NULL,   -- YYYY-MM-DD (expiry)

  renewed_from_policy_id TEXT,

  premium_paise          INTEGER,         -- store money in paise
  premium_currency       TEXT NOT NULL DEFAULT 'INR',

  notes                  TEXT,

  assigned_to            TEXT,
  created_by             TEXT,

  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,

  FOREIGN KEY (policy_type_id) REFERENCES policy_types(id) ON DELETE SET NULL,
  FOREIGN KEY (insurer_id) REFERENCES insurers(id) ON DELETE SET NULL,

  FOREIGN KEY (renewed_from_policy_id) REFERENCES policies(id) ON DELETE SET NULL,

  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- "Expiring soon" index (critical)
CREATE INDEX idx_policies_expiry ON policies(agency_id, end_date, status);

CREATE INDEX idx_policies_client ON policies(agency_id, client_id);
CREATE INDEX idx_policies_assignee ON policies(agency_id, assigned_to, end_date);

-- Policy number uniqueness (nullable-safe)
CREATE UNIQUE INDEX uq_policies_agency_policy_number
  ON policies(agency_id, policy_number)
  WHERE policy_number IS NOT NULL;

CREATE TABLE renewal_events (
  id          TEXT PRIMARY KEY,
  agency_id   TEXT NOT NULL,
  policy_id   TEXT NOT NULL,

  event_type  TEXT NOT NULL,
  -- contacted, reminded, docs_requested, docs_received, payment_pending, renewed, lost

  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes       TEXT,
  created_by  TEXT,

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_renewal_events_policy
  ON renewal_events(agency_id, policy_id, occurred_at DESC);


CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  agency_id   TEXT NOT NULL,

  policy_id   TEXT,
  client_id   TEXT,

  title       TEXT NOT NULL,
  due_at      TEXT NOT NULL, -- datetime ISO
  status      TEXT NOT NULL DEFAULT 'open', -- open, done, canceled

  assigned_to TEXT,
  created_by  TEXT,

  created_at  TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_due ON tasks(agency_id, status, due_at);


CREATE TABLE documents (
  id          TEXT PRIMARY KEY,
  agency_id   TEXT NOT NULL,

  client_id   TEXT,
  policy_id   TEXT,

  doc_type    TEXT NOT NULL, -- policy_pdf, kyc, receipt, other
  file_name   TEXT NOT NULL,
  mime_type   TEXT,
  file_size   INTEGER,
  storage_key TEXT NOT NULL, -- pointer to R2/S3/etc
  uploaded_by TEXT,

  created_at  TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_documents_lookup
  ON documents(agency_id, policy_id, client_id, created_at DESC);


CREATE TABLE reminder_rules (
  id          TEXT PRIMARY KEY,
  agency_id   TEXT NOT NULL,

  days_before INTEGER NOT NULL, -- 30, 15, 7, 1
  channel     TEXT NOT NULL,    -- whatsapp, sms, email
  enabled     INTEGER NOT NULL DEFAULT 1, -- 0/1

  created_at  TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_reminder_rules
  ON reminder_rules(agency_id, days_before, channel);


CREATE TABLE outbound_messages (
  id                  TEXT PRIMARY KEY,
  agency_id           TEXT NOT NULL,

  policy_id           TEXT,
  client_id           TEXT,

  channel             TEXT NOT NULL, -- whatsapp, sms, email
  to_address          TEXT NOT NULL, -- phone/email
  template_key        TEXT,
  body                TEXT,

  status              TEXT NOT NULL DEFAULT 'queued',
  -- queued, sent, delivered, failed

  provider_message_id TEXT,
  error_message       TEXT,

  scheduled_at        TEXT,
  sent_at             TEXT,

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX idx_outbound_messages_status
  ON outbound_messages(agency_id, status, scheduled_at);


CREATE TABLE imports (
  id           TEXT PRIMARY KEY,
  agency_id    TEXT NOT NULL,
  created_by   TEXT,

  source       TEXT NOT NULL, -- excel, csv
  file_name    TEXT NOT NULL,
  storage_key  TEXT NOT NULL,

  status       TEXT NOT NULL DEFAULT 'pending',
  -- pending, processing, completed, failed

  total_rows   INTEGER,
  success_rows INTEGER,
  failed_rows  INTEGER,

  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE import_rows (
  id            TEXT PRIMARY KEY,
  agency_id     TEXT NOT NULL,
  import_id     TEXT NOT NULL,

  row_number    INTEGER NOT NULL,
  raw_json_text TEXT NOT NULL, -- JSON string
  status        TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_import_rows_row
  ON import_rows(agency_id, import_id, row_number);

CREATE INDEX idx_import_rows_status
  ON import_rows(agency_id, import_id, status);


CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  agency_id     TEXT NOT NULL,
  actor_user_id TEXT,

  entity_type   TEXT NOT NULL, -- client, policy, document, task
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL, -- create, update, delete

  metadata_json TEXT,          -- JSON string (optional)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_agency_time
  ON audit_log(agency_id, created_at DESC);
