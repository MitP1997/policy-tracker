/**
 * Import row validation and parsing (shared by API and optionally UI).
 * No DB access; policy number uniqueness is checked by the API.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface NormalizedImportRow {
  rowNumber: number;
  clientFullName: string;
  phone: string | null;
  email: string | null;
  insurerName: string;
  insuranceType: string;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string;
  premiumPaise: number | null;
  assignedToUserId: string | null;
}

export interface ValidateImportRowContext {
  /** Set of policy numbers already used in this agency (for batch uniqueness). */
  existingPolicyNumbers?: Set<string>;
}

export interface ValidateImportRowResult {
  valid: boolean;
  errorMessage?: string;
}

/**
 * Parse premium to paise. Accepts number; if it has decimals or is a small
 * integer, treat as rupees and multiply by 100. Otherwise treat as paise.
 */
export function parsePremiumToPaise(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  if (!Number.isFinite(n)) return null;
  // If it looks like rupees (has decimal or small whole number), convert to paise
  if (n % 1 !== 0 || n < 10000) {
    return Math.round(n * 100);
  }
  return Math.round(n);
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

/**
 * Validate a normalized import row. Does not check policy number uniqueness
 * against DB; the API should pass existingPolicyNumbers in context when needed.
 */
export function validateImportRow(
  row: NormalizedImportRow,
  context?: ValidateImportRowContext
): ValidateImportRowResult {
  const fullName = typeof row.clientFullName === "string" ? row.clientFullName.trim() : "";
  if (!fullName) {
    return { valid: false, errorMessage: "clientFullName is required" };
  }

  const endDate = parseDate(row.endDate);
  if (!endDate) {
    return { valid: false, errorMessage: "endDate is required and must be YYYY-MM-DD" };
  }

  const startDate =
    row.startDate != null && row.startDate !== ""
      ? parseDate(row.startDate)
      : null;
  if (row.startDate != null && row.startDate !== "" && !startDate) {
    return { valid: false, errorMessage: "startDate must be YYYY-MM-DD when provided" };
  }

  if (row.premiumPaise != null && row.premiumPaise !== undefined) {
    const n = Number(row.premiumPaise);
    if (!Number.isInteger(n) || n < 0) {
      return { valid: false, errorMessage: "premiumPaise must be a non-negative integer" };
    }
  }

  const insurerName = typeof row.insurerName === "string" ? row.insurerName.trim() : "";
  const insuranceType = typeof row.insuranceType === "string" ? row.insuranceType.trim() : "";
  if (!insurerName) return { valid: false, errorMessage: "insurerName is required" };
  if (!insuranceType) return { valid: false, errorMessage: "insuranceType is required" };

  const policyNumber =
    row.policyNumber === null || row.policyNumber === undefined
      ? null
      : typeof row.policyNumber === "string"
        ? row.policyNumber.trim() || null
        : null;
  if (policyNumber && context?.existingPolicyNumbers?.has(policyNumber)) {
    return { valid: false, errorMessage: "policy_number already exists in this agency" };
  }

  return { valid: true };
}

/** Chunk size for import rows (TDD: e.g. 100–500). */
export const IMPORT_CHUNK_SIZE = 500;

/** Max rows per import (TDD: e.g. 10k). */
export const IMPORT_MAX_TOTAL_ROWS = 10_000;
