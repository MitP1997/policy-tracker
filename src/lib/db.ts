/**
 * Get D1 database from Cloudflare Workers context.
 * Same pattern as godizzy: use getCloudflareContext({ async: true }) so bindings
 * are available when the app runs via wrangler dev (OpenNext build).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const DB = (env as unknown as { DB?: D1Database }).DB;
  if (!DB) {
    throw new Error(
      "Missing D1 binding `DB`. Ensure wrangler.jsonc has a d1_databases binding named DB and run dev with `npm run dev` (OpenNext + wrangler dev)."
    );
  }
  return DB;
}
