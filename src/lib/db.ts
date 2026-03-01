/**
 * Get D1 database from Cloudflare Workers context.
 * When the app runs on Cloudflare Workers (e.g. via @opennextjs/cloudflare),
 * the DB binding is available via getCloudflareContext().env.DB.
 * If context is missing (e.g. local dev without wrangler), returns null so
 * callers can return 503.
 */
export function getDb(): D1Database | null {
  try {
    // Optional: only resolves when @opennextjs/cloudflare is installed and context is set
    const mod = require("@opennextjs/cloudflare") as {
      getCloudflareContext?: () => { env?: { DB?: D1Database } };
    };
    const ctx = mod.getCloudflareContext?.();
    return ctx?.env?.DB ?? null;
  } catch {
    return null;
  }
}
