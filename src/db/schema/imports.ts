import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { users } from "./users";

export const importStatusValues = ["pending", "processing", "completed", "failed"] as const;
export type ImportStatus = (typeof importStatusValues)[number];

export const imports = sqliteTable(
  "imports",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),

    source: text("source").notNull(), // csv | excel
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key"),

    status: text("status").$type<ImportStatus>().notNull().default("pending"),

    totalRows: integer("total_rows"),
    successRows: integer("success_rows"),
    failedRows: integer("failed_rows"),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    completedAt: text("completed_at")
  },
  (t) => ({
    agencyIdx: index("idx_imports_agency").on(t.agencyId, t.createdAt)
  })
);

