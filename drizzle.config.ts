import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for Cloudflare D1 using d1-http driver.
 *
 * Environment variables required (set in .env):
 * - CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
 * - CLOUDFLARE_D1_TOKEN: API token with D1 read/write permissions
 * - D1_DATABASE_ID: Target database ID (from wrangler.jsonc d1_databases[].database_id)
 */
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
