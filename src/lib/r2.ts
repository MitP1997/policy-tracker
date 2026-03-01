/**
 * Get R2 bucket from Cloudflare Workers context.
 * Same pattern as getDb(): use getCloudflareContext({ async: true }) so bindings
 * are available when the app runs via wrangler dev (OpenNext build).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getBucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  const BUCKET = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!BUCKET) {
    throw new Error(
      "Missing R2 binding `BUCKET`. Ensure wrangler.jsonc has an r2_buckets binding named BUCKET and run dev with `npm run dev` (OpenNext + wrangler dev)."
    );
  }
  return BUCKET;
}
