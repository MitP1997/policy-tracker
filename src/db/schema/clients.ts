import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { households } from "./households";
import { users } from "./users";

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),

    fullName: text("full_name").notNull(),
    phone: text("phone"),
    callingNumber: text("calling_number"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),

    householdId: text("household_id").references(() => households.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    agencyIdx: index("idx_clients_agency").on(t.agencyId),
    householdIdx: index("idx_clients_household").on(t.agencyId, t.householdId)
  })
);

