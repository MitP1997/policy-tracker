import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { clients } from "./clients";
import { policies } from "./policies";
import { users } from "./users";

export const reminderStatusValues = ["open", "done", "dismissed"] as const;
export type ReminderStatus = (typeof reminderStatusValues)[number];

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),

    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    dueOn: text("due_on").notNull(), // YYYY-MM-DD
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    status: text("status").$type<ReminderStatus>().notNull().default("open"),
    ruleDaysBefore: integer("rule_days_before").notNull(),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    dailyViewIdx: index("idx_reminders_daily_view").on(t.agencyId, t.assignedTo, t.status, t.dueOn),
    idempotencyUq: uniqueIndex("uq_reminders_idempotency").on(
      t.agencyId,
      t.policyId,
      t.assignedTo,
      t.dueOn,
      t.ruleDaysBefore
    )
  })
);

