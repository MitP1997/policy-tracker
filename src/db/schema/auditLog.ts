import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { users } from "./users";

export const auditActionValues = ["create", "update", "delete"] as const;
export type AuditAction = (typeof auditActionValues)[number];

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),

    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").$type<AuditAction>().notNull(),

    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    agencyTimeIdx: index("idx_audit_agency_time").on(t.agencyId, t.createdAt)
  })
);

