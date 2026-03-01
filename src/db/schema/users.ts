import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";

export const userRoleValues = ["owner", "staff"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const userStatusValues = ["active", "disabled"] as const;
export type UserStatus = (typeof userStatusValues)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    phone: text("phone").notNull(),

    role: text("role").$type<UserRole>().notNull().default("owner"),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    lastLoginAt: text("last_login_at"),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    agencyIdx: index("idx_users_agency").on(t.agencyId),
    agencyPhoneUq: uniqueIndex("uq_users_agency_phone").on(t.agencyId, t.phone)
  })
);

