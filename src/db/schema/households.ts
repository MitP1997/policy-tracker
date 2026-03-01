import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";

export const households = sqliteTable(
  "households",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    agencyIdx: index("idx_households_agency").on(t.agencyId),
    agencyNameUq: uniqueIndex("uq_households_agency_name").on(t.agencyId, t.name)
  })
);

