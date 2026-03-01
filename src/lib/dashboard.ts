import type { Session } from "@/lib/auth/session";
import { getTodayInTimezone, addDays } from "@/lib/date";

export type ExpiryBucketKey = "expired" | "0-7" | "8-30" | "31-60";

export type ExpiryBucketItem = {
  id: string;
  agencyId: string;
  clientId: string;
  insuranceType: string;
  insurerName: string;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string;
  premiumPaise: number | null;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  clientFullName?: string;
  links: { detail: string; edit: string };
};

export type ExpiryBuckets = {
  expired: ExpiryBucketItem[];
  "0-7": ExpiryBucketItem[];
  "8-30": ExpiryBucketItem[];
  "31-60": ExpiryBucketItem[];
};

type PolicyRow = {
  id: string;
  agency_id: string;
  client_id: string;
  insurance_type: string;
  insurer_name: string;
  policy_number: string | null;
  start_date: string | null;
  end_date: string;
  premium_paise: number | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  client_full_name?: string;
};

function toBucketItem(r: PolicyRow): ExpiryBucketItem {
  return {
    id: r.id,
    agencyId: r.agency_id,
    clientId: r.client_id,
    insuranceType: r.insurance_type,
    insurerName: r.insurer_name,
    policyNumber: r.policy_number,
    startDate: r.start_date,
    endDate: r.end_date,
    premiumPaise: r.premium_paise,
    status: r.status,
    assignedTo: r.assigned_to,
    notes: r.notes,
    clientFullName: r.client_full_name,
    links: {
      detail: `/policies/${r.id}`,
      edit: `/policies/${r.id}/edit`
    }
  };
}

/**
 * Fetch policies in expiry window (expired + next window_days), then bucket by
 * expired / 0-7 / 8-30 / 31-60 days. Uses agency timezone for "today".
 */
export async function getExpiryBuckets(
  db: D1Database,
  session: Session,
  windowDays: number = 60
): Promise<ExpiryBuckets> {
  const timezoneRow = await db
    .prepare("SELECT timezone FROM agencies WHERE id = ?")
    .bind(session.agency_id)
    .first<{ timezone: string }>();

  const timezone = timezoneRow?.timezone ?? "Asia/Kolkata";
  const today = getTodayInTimezone(timezone);
  const todayPlus7 = addDays(today, 7);
  const todayPlus30 = addDays(today, 30);
  const todayPlus60 = addDays(today, windowDays > 60 ? windowDays : 60);

  const conditions: string[] = ["p.agency_id = ?"];
  const bindValues: (string | number)[] = [session.agency_id];

  if (session.role === "staff") {
    conditions.push("p.assigned_to = ?");
    bindValues.push(session.user_id);
  }

  conditions.push(
    `(date(p.end_date) < date(?) OR (date(p.end_date) >= date(?) AND date(p.end_date) <= date(?)))`
  );
  bindValues.push(today, today, todayPlus60);

  const where = conditions.join(" AND ");
  const sql = `SELECT p.id, p.agency_id, p.client_id, p.insurance_type, p.insurer_name, p.policy_number,
    p.start_date, p.end_date, p.premium_paise, p.status, p.assigned_to, p.notes,
    c.full_name as client_full_name
    FROM policies p
    LEFT JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
    WHERE ${where}
    ORDER BY p.end_date ASC`;

  const stmt = db.prepare(sql).bind(...bindValues);
  const result = await stmt.all<PolicyRow>();
  const rows = result.results ?? [];

  const buckets: ExpiryBuckets = {
    expired: [],
    "0-7": [],
    "8-30": [],
    "31-60": []
  };

  for (const row of rows) {
    const item = toBucketItem(row);
    const end = row.end_date;

    if (end < today) {
      buckets.expired.push(item);
    } else if (end <= todayPlus7) {
      buckets["0-7"].push(item);
    } else if (end <= todayPlus30) {
      buckets["8-30"].push(item);
    } else if (end <= todayPlus60) {
      buckets["31-60"].push(item);
    }
  }

  return buckets;
}
