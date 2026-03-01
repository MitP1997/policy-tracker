import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { imports } from "./imports";

export const importRowStatusValues = ["pending", "valid", "invalid"] as const;
export type ImportRowStatus = (typeof importRowStatusValues)[number];

export const importRows = sqliteTable(
  "import_rows",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    importId: text("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),

    rowNumber: integer("row_number").notNull(),
    rawJsonText: text("raw_json_text").notNull(),
    status: text("status").$type<ImportRowStatus>().notNull().default("pending"),
    errorMessage: text("error_message"),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    rowUq: uniqueIndex("uq_import_rows_row").on(t.agencyId, t.importId, t.rowNumber),
    statusIdx: index("idx_import_rows_status").on(t.agencyId, t.importId, t.status)
  })
);

