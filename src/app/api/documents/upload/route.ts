import { getBucket } from "@/lib/r2";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents";

export async function POST(request: Request): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonError("Content-Type must be multipart/form-data", "validation", 400);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isNaN(size) && size > MAX_DOCUMENT_SIZE_BYTES) {
      return jsonError(
        `File too large. Maximum size is ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024} MB`,
        "payload_too_large",
        413
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", "invalid_body", 400);
  }

  const storageKey = formData.get("storageKey");
  const key =
    typeof storageKey === "string" ? storageKey.trim() : "";
  if (!key) return jsonError("storageKey is required", "validation", 400);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return jsonError("file is required", "validation", 400);
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError(
      `File too large. Maximum size is ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024} MB`,
      "payload_too_large",
      413
    );
  }

  if (!key.startsWith(`${result.agency_id}/`)) {
    return jsonError("Invalid storageKey for this agency", "validation", 400);
  }

  let bucket: R2Bucket;
  try {
    bucket = await getBucket();
  } catch {
    return jsonError("Storage not available", "unavailable", 503);
  }

  const arrayBuffer = await file.arrayBuffer();
  await bucket.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    }
  });

  return jsonBody({ storageKey: key });
}
