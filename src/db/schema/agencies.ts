import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agencyStatusValues = ["active", "suspended", "canceled"] as const;
export type AgencyStatus = (typeof agencyStatusValues)[number];

export const agencies = sqliteTable(
  "agencies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id"),
    phone: text("phone"),
    email: text("email"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    plan: text("plan").notNull().default("free"),
    status: text("status").$type<AgencyStatus>().notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    statusIdx: index("idx_agencies_status").on(t.status)
  })
);

