import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";

export const reminderRules = sqliteTable(
  "reminder_rules",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),

    daysBefore: integer("days_before").notNull(), // e.g. 30, 15, 7, 1
    enabled: integer("enabled").notNull().default(1), // 0/1

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    agencyDaysBeforeUq: uniqueIndex("uq_reminder_rules_agency_days_before").on(t.agencyId, t.daysBefore)
  })
);

