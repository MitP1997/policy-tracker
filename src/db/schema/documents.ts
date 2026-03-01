import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { agencies } from "./agencies";
import { clients } from "./clients";
import { policies } from "./policies";
import { users } from "./users";

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),

    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    policyId: text("policy_id").references(() => policies.id, { onDelete: "cascade" }),

    docType: text("doc_type").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    storageKey: text("storage_key").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    lookupIdx: index("idx_documents_lookup").on(t.agencyId, t.policyId, t.clientId, t.createdAt)
  })
);

