import { getTodayInTimezone, addDays } from "@/lib/date";
import { sendReminderViaWhatsApp } from "@/lib/whatsapp";

export type ReminderRuleRow = {
  id: string;
  daysBefore: number;
  enabled: number;
};

export type TodaysReminderItem = {
  id: string;
  policyId: string;
  clientId: string;
  dueOn: string;
  ruleDaysBefore: number;
  policyNumber: string | null;
  endDate: string;
  insurerName: string;
  insuranceType: string;
  clientFullName: string | null;
};

/**
 * Get reminder rules for an agency (all rules, including disabled).
 */
export async function getReminderRules(
  db: D1Database,
  agencyId: string
): Promise<ReminderRuleRow[]> {
  const result = await db
    .prepare(
      "SELECT id, days_before as daysBefore, enabled FROM reminder_rules WHERE agency_id = ? ORDER BY days_before DESC"
    )
    .bind(agencyId)
    .all<{ id: string; daysBefore: number; enabled: number }>();

  const rows = result.results ?? [];
  return rows;
}

/**
 * Get today's open reminders for a user in an agency, with policy/client summary.
 */
export async function getTodaysReminders(
  db: D1Database,
  agencyId: string,
  userId: string,
  today: string
): Promise<TodaysReminderItem[]> {
  const result = await db
    .prepare(
      `SELECT r.id, r.policy_id as policyId, r.client_id as clientId, r.due_on as dueOn, r.rule_days_before as ruleDaysBefore,
        p.policy_number as policyNumber, p.end_date as endDate, p.insurer_name as insurerName, p.insurance_type as insuranceType,
        c.full_name as clientFullName
       FROM reminders r
       JOIN policies p ON p.id = r.policy_id AND p.agency_id = r.agency_id
       JOIN clients c ON c.id = r.client_id AND c.agency_id = r.agency_id
       WHERE r.agency_id = ? AND r.assigned_to = ? AND r.due_on = ? AND r.status = 'open'
       ORDER BY r.due_on, r.rule_days_before`
    )
    .bind(agencyId, userId, today)
    .all<{
      id: string;
      policyId: string;
      clientId: string;
      dueOn: string;
      ruleDaysBefore: number;
      policyNumber: string | null;
      endDate: string;
      insurerName: string;
      insuranceType: string;
      clientFullName: string | null;
    }>();

  return result.results ?? [];
}

export type ReminderGenerationSummary = {
  agenciesProcessed: number;
  remindersCreated: number;
};

/**
 * Generate reminders idempotently for all agencies: for each agency and each enabled
 * rule, find policies expiring in rule.days_before days and create reminders for
 * assignee (or owner). Calls WhatsApp placeholder per created reminder.
 */
export async function runReminderGeneration(
  db: D1Database
): Promise<ReminderGenerationSummary> {
  const agenciesResult = await db
    .prepare(
      "SELECT id, timezone, owner_user_id as ownerUserId FROM agencies WHERE status = 'active'"
    )
    .all<{ id: string; timezone: string | null; ownerUserId: string | null }>();

  const agencies = agenciesResult.results ?? [];
  let remindersCreated = 0;

  for (const agency of agencies) {
    const timezone = agency.timezone ?? "Asia/Kolkata";
    const today = getTodayInTimezone(timezone);

    const rulesResult = await db
      .prepare(
        "SELECT id, days_before as daysBefore FROM reminder_rules WHERE agency_id = ? AND enabled = 1"
      )
      .bind(agency.id)
      .all<{ id: string; daysBefore: number }>();

    const rules = rulesResult.results ?? [];

    for (const rule of rules) {
      const targetEndDate = addDays(today, rule.daysBefore);

      const policiesResult = await db
        .prepare(
          `SELECT p.id, p.agency_id as agencyId, p.client_id as clientId, p.assigned_to as assignedTo,
            p.policy_number as policyNumber, p.end_date as endDate
           FROM policies p
           WHERE p.agency_id = ? AND date(p.end_date) = date(?) AND p.status IN ('active', 'renewal_in_progress')`
        )
        .bind(agency.id, targetEndDate)
        .all<{
          id: string;
          agencyId: string;
          clientId: string;
          assignedTo: string | null;
          policyNumber: string | null;
          endDate: string;
        }>();

      const policies = policiesResult.results ?? [];

      for (const policy of policies) {
        const assigneeId =
          policy.assignedTo ?? agency.ownerUserId ?? null;
        if (!assigneeId) continue;

        const reminderId = crypto.randomUUID();
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO reminders (id, agency_id, policy_id, client_id, due_on, assigned_to, status, rule_days_before, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?, datetime('now'))`
        ).bind(
          reminderId,
          agency.id,
          policy.id,
          policy.clientId,
          today,
          assigneeId,
          rule.daysBefore
        );

        const insertResult = await stmt.run();
        if (insertResult.meta.changes > 0) {
          remindersCreated += 1;
          const userRow = await db
            .prepare("SELECT phone FROM users WHERE id = ?")
            .bind(assigneeId)
            .first<{ phone: string }>();
          const toNumber = userRow?.phone ?? "";
          await sendReminderViaWhatsApp(reminderId, toNumber, {
            policyNumber: policy.policyNumber ?? undefined,
            endDate: policy.endDate,
            daysBefore: rule.daysBefore
          });
        }
      }
    }
  }

  return {
    agenciesProcessed: agencies.length,
    remindersCreated
  };
}

/**
 * Materialize expired status: set policies with end_date < today to status 'expired'
 * when currently active or renewal_in_progress.
 */
export async function runMaterializedExpiry(db: D1Database): Promise<void> {
  const agenciesResult = await db
    .prepare("SELECT id, timezone FROM agencies WHERE status = 'active'")
    .all<{ id: string; timezone: string | null }>();

  const agencies = agenciesResult.results ?? [];

  for (const agency of agencies) {
    const timezone = agency.timezone ?? "Asia/Kolkata";
    const today = getTodayInTimezone(timezone);

    await db
      .prepare(
        `UPDATE policies SET status = 'expired', status_updated_at = datetime('now'), status_updated_by = NULL, updated_at = datetime('now')
         WHERE agency_id = ? AND date(end_date) < date(?) AND status IN ('active', 'renewal_in_progress')`
      )
      .bind(agency.id, today)
      .run();
  }
}
