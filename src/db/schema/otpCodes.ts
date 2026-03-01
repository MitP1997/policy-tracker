import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    phone: text("phone").notNull(),
    code: text("code").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    phoneIdx: index("idx_otp_codes_phone").on(t.phone),
    expiresIdx: index("idx_otp_codes_expires_at").on(t.expiresAt)
  })
);
