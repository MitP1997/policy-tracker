import { getDb } from "@/lib/db";
import { jsonBody, jsonError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  type NormalizedImportRow,
  validateImportRow,
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_TOTAL_ROWS
} from "@/lib/imports";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  const { id: importId } = await params;
  if (!importId) {
    return jsonError("Import id is required", "validation", 400);
  }

  let body: { rows?: NormalizedImportRow[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", "invalid_body", 400);
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return jsonError("rows array is required and must not be empty", "validation", 400);
  }
  if (rows.length > IMPORT_CHUNK_SIZE) {
    return jsonError(
      `At most ${IMPORT_CHUNK_SIZE} rows per chunk`,
      "validation",
      400
    );
  }

  let db: D1Database;
  try {
    db = await getDb();
  } catch {
    return jsonError("DB not available", "unavailable", 503);
  }

  const importRow = await db
    .prepare(
      "SELECT id, status, total_rows FROM imports WHERE id = ? AND agency_id = ?"
    )
    .bind(importId, result.agency_id)
    .first<{ id: string; status: string; total_rows: number | null }>();

  if (!importRow) {
    return jsonError("Import not found", "not_found", 404);
  }
  if (importRow.status !== "pending" && importRow.status !== "processing") {
    return jsonError("Import is not accepting rows", "validation", 400);
  }

  const currentTotal = importRow.total_rows ?? 0;
  if (currentTotal + rows.length > IMPORT_MAX_TOTAL_ROWS) {
    return jsonError(
      `Import cannot exceed ${IMPORT_MAX_TOTAL_ROWS} rows`,
      "validation",
      400
    );
  }

  // Set status to processing on first chunk
  if (importRow.status === "pending") {
    await db
      .prepare("UPDATE imports SET status = 'processing' WHERE id = ?")
      .bind(importId)
      .run();
  }

  // Load existing policy numbers for agency (for uniqueness check)
  const policyNumbersResult = await db
    .prepare("SELECT policy_number FROM policies WHERE agency_id = ? AND policy_number IS NOT NULL")
    .bind(result.agency_id)
    .all<{ policy_number: string }>();
  const existingPolicyNumbers = new Set(
    (policyNumbersResult.results ?? []).map((r) => r.policy_number)
  );

  const errors: { rowNumber: number; errorMessage: string }[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const row of rows) {
    const rowNum = Number(row.rowNumber);
    if (!Number.isInteger(rowNum) || rowNum < 1) {
      invalidCount++;
      errors.push({ rowNumber: rowNum, errorMessage: "Invalid rowNumber" });
      const rowId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO import_rows (id, agency_id, import_id, row_number, raw_json_text, status, error_message)
           VALUES (?, ?, ?, ?, ?, 'invalid', ?)`
        )
        .bind(rowId, result.agency_id, importId, rowNum, JSON.stringify(row), "Invalid rowNumber")
        .run();
      continue;
    }

    const existing = await db
      .prepare(
        "SELECT 1 FROM import_rows WHERE import_id = ? AND agency_id = ? AND row_number = ?"
      )
      .bind(importId, result.agency_id, rowNum)
      .first();
    if (existing) {
      continue;
    }

    const validation = validateImportRow(row, { existingPolicyNumbers });
    if (!validation.valid) {
      invalidCount++;
      errors.push({ rowNumber: rowNum, errorMessage: validation.errorMessage ?? "Validation failed" });
      const rowId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO import_rows (id, agency_id, import_id, row_number, raw_json_text, status, error_message)
           VALUES (?, ?, ?, ?, ?, 'invalid', ?)`
        )
        .bind(
          rowId,
          result.agency_id,
          importId,
          rowNum,
          JSON.stringify(row),
          validation.errorMessage ?? "Validation failed"
        )
        .run();
      continue;
    }

    // Validate assignee if provided
    let assignedTo: string | null =
      row.assignedToUserId != null && row.assignedToUserId !== ""
        ? String(row.assignedToUserId).trim() || null
        : null;
    if (assignedTo) {
      const user = await db
        .prepare("SELECT id FROM users WHERE id = ? AND agency_id = ?")
        .bind(assignedTo, result.agency_id)
        .first<{ id: string }>();
      if (!user) {
        invalidCount++;
        errors.push({ rowNumber: rowNum, errorMessage: "Assigned user not found or not in agency" });
        const rowId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO import_rows (id, agency_id, import_id, row_number, raw_json_text, status, error_message)
             VALUES (?, ?, ?, ?, ?, 'invalid', ?)`
          )
          .bind(
            rowId,
            result.agency_id,
            importId,
            rowNum,
            JSON.stringify(row),
            "Assigned user not found or not in agency"
          )
          .run();
        continue;
      }
    }

    const fullName = String(row.clientFullName).trim();
    const phone =
      row.phone != null && row.phone !== "" ? String(row.phone).trim() || null : null;
    const email =
      row.email != null && row.email !== "" ? String(row.email).trim() || null : null;
    const insurerName = String(row.insurerName).trim();
    const insuranceType = String(row.insuranceType).trim();
    const policyNumber =
      row.policyNumber != null && row.policyNumber !== ""
        ? String(row.policyNumber).trim() || null
        : null;
    const startDate = parseDate(row.startDate);
    const endDate = parseDate(row.endDate)!;
    const premiumPaise =
      row.premiumPaise != null && row.premiumPaise !== undefined
        ? Number(row.premiumPaise)
        : null;
    const status = "active";

    let clientId: string;
    if (phone) {
      const existingClient = await db
        .prepare(
          "SELECT id FROM clients WHERE agency_id = ? AND full_name = ? AND (phone = ? OR (phone IS NULL AND ? IS NULL))"
        )
        .bind(result.agency_id, fullName, phone, phone)
        .first<{ id: string }>();
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        clientId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO clients (id, agency_id, full_name, phone, calling_number, email, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          )
          .bind(clientId, result.agency_id, fullName, phone, phone, email, result.user_id)
          .run();
        await writeAuditLog(db, {
          agencyId: result.agency_id,
          actorUserId: result.user_id,
          entityType: "client",
          entityId: clientId,
          action: "create",
          metadata: { fullName, importId }
        });
      }
    } else {
      clientId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO clients (id, agency_id, full_name, phone, calling_number, email, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(clientId, result.agency_id, fullName, null, null, email, result.user_id)
        .run();
      await writeAuditLog(db, {
        agencyId: result.agency_id,
        actorUserId: result.user_id,
        entityType: "client",
        entityId: clientId,
        action: "create",
        metadata: { fullName, importId }
      });
    }

    const policyId = crypto.randomUUID();
    try {
      await db
        .prepare(
          `INSERT INTO policies (
            id, agency_id, client_id, insurance_type, insurer_name, policy_number,
            start_date, end_date, premium_paise, status, assigned_to,
            status_updated_at, status_updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, datetime('now'), datetime('now'))`
        )
        .bind(
          policyId,
          result.agency_id,
          clientId,
          insuranceType,
          insurerName,
          policyNumber,
          startDate,
          endDate,
          premiumPaise,
          status,
          assignedTo
        )
        .run();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Policy insert failed";
      const isConflict = message.includes("UNIQUE") || message.includes("uq_policies");
      if (isConflict && policyNumber) {
        existingPolicyNumbers.add(policyNumber);
        invalidCount++;
        errors.push({ rowNumber: rowNum, errorMessage: "policy_number already exists in this agency" });
        const rowId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO import_rows (id, agency_id, import_id, row_number, raw_json_text, status, error_message)
             VALUES (?, ?, ?, ?, ?, 'invalid', ?)`
          )
          .bind(
            rowId,
            result.agency_id,
            importId,
            rowNum,
            JSON.stringify(row),
            "policy_number already exists in this agency"
          )
          .run();
        continue;
      }
      throw err;
    }

    if (policyNumber) {
      existingPolicyNumbers.add(policyNumber);
    }
    await writeAuditLog(db, {
      agencyId: result.agency_id,
      actorUserId: result.user_id,
      entityType: "policy",
      entityId: policyId,
      action: "create",
      metadata: { insuranceType, insurerName, endDate, importId }
    });

    const rowId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO import_rows (id, agency_id, import_id, row_number, raw_json_text, status)
         VALUES (?, ?, ?, ?, ?, 'valid')`
      )
      .bind(rowId, result.agency_id, importId, rowNum, JSON.stringify(row))
      .run();
    validCount++;
  }

  const currentCounts = await db
    .prepare(
      "SELECT total_rows, success_rows, failed_rows FROM imports WHERE id = ?"
    )
    .bind(importId)
    .first<{ total_rows: number | null; success_rows: number | null; failed_rows: number | null }>();

  const newTotal = (currentCounts?.total_rows ?? 0) + rows.length;
  const newSuccess = (currentCounts?.success_rows ?? 0) + validCount;
  const newFailed = (currentCounts?.failed_rows ?? 0) + invalidCount;

  await db
    .prepare(
      "UPDATE imports SET total_rows = ?, success_rows = ?, failed_rows = ? WHERE id = ?"
    )
    .bind(newTotal, newSuccess, newFailed, importId)
    .run();

  return jsonBody({
    processed: rows.length,
    valid: validCount,
    invalid: invalidCount,
    ...(errors.length > 0 ? { errors } : {})
  });
}
