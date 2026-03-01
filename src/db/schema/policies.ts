import { isNotNull, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { clients } from "./clients";
import { users } from "./users";

export const policyStatusValues = ["active", "renewal_in_progress", "renewed", "lost", "expired"] as const;
export type PolicyStatus = (typeof policyStatusValues)[number];

export const policies = sqliteTable(
  "policies",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    insuranceType: text("insurance_type").notNull(),
    insurerName: text("insurer_name").notNull(),
    policyNumber: text("policy_number"),

    startDate: text("start_date"), // YYYY-MM-DD
    endDate: text("end_date").notNull(), // YYYY-MM-DD

    premiumPaise: integer("premium_paise"),

    status: text("status").$type<PolicyStatus>().notNull().default("active"),

    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),

    statusUpdatedAt: text("status_updated_at"),
    statusUpdatedBy: text("status_updated_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    expiryIdx: index("idx_policies_expiry").on(t.agencyId, t.endDate, t.status),
    clientIdx: index("idx_policies_client").on(t.agencyId, t.clientId),
    assigneeIdx: index("idx_policies_assignee").on(t.agencyId, t.assignedTo, t.endDate),
    agencyPolicyNumberUq: uniqueIndex("uq_policies_agency_policy_number")
      .on(t.agencyId, t.policyNumber)
      .where(isNotNull(t.policyNumber))
  })
);

