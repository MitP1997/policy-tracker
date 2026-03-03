"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NormalizedImportRow } from "@/lib/imports";
import { parsePremiumToPaise, IMPORT_CHUNK_SIZE } from "@/lib/imports";

type User = { id: string; name: string; phone: string };
type RawRow = Record<string, string | number | undefined>;

const TARGET_FIELDS = [
  { key: "clientFullName", label: "Client name", required: true },
  { key: "phone", label: "Phone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "insurerName", label: "Insurer name", required: true },
  { key: "insuranceType", label: "Insurance type", required: true },
  { key: "policyNumber", label: "Policy number", required: false },
  { key: "startDate", label: "Start date", required: false },
  { key: "endDate", label: "End date", required: true },
  { key: "premiumPaise", label: "Premium (number)", required: false },
  { key: "assignedToUserId", label: "Assignee (user id)", required: false }
] as const;

function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0];
  const headers = parseCSVLine(header);
  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: RawRow = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let val = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          i++;
          if (line[i] === '"') {
            val += '"';
            i++;
          } else break;
        } else {
          val += line[i];
          i++;
        }
      }
      out.push(val);
    } else {
      let val = "";
      while (i < line.length && line[i] !== ",") {
        val += line[i];
        i++;
      }
      out.push(val.trim());
      if (line[i] === ",") i++;
    }
  }
  return out;
}

function getHeaders(rows: RawRow[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"csv" | "excel">("csv");
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importId, setImportId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ sent: 0, total: 0, valid: 0, invalid: 0 });
  const [importDone, setImportDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    const name = f.name.toLowerCase();
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
    setSource(isExcel ? "excel" : "csv");
    setFile(f);

    if (isExcel) {
      const XLSX = await import("xlsx");
      const data = new Uint8Array(await f.arrayBuffer());
      const wb = XLSX.read(data, { type: "array" });
      const first = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(first) as Record<string, unknown>[];
      const rows: RawRow[] = json.map((r: Record<string, unknown>) => {
        const out: RawRow = {};
        for (const [k, v] of Object.entries(r)) {
          out[k] = v != null ? String(v) : "";
        }
        return out;
      });
      setRawRows(rows);
      setHeaders(rows.length > 0 ? Object.keys(rows[0]) : []);
    } else {
      const text = await f.text();
      const rows = parseCSV(text);
      setRawRows(rows);
      setHeaders(rows.length > 0 ? Object.keys(rows[0]) : []);
    }
    setStep(2);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = (await res.json()) as { users?: User[] };
      setUsers(data.users ?? []);
    }
  }, []);

  const buildNormalizedRows = useCallback((): NormalizedImportRow[] => {
    return rawRows.map((row, idx) => {
      const get = (key: string) => {
        const col = mapping[key];
        if (!col || col === "") return null;
        const v = row[col];
        return v != null && v !== "" ? String(v).trim() : null;
      };
      const getReq = (key: string) => get(key) ?? "";
      const premiumRaw = get("premiumPaise");
      const premiumPaise = premiumRaw != null ? parsePremiumToPaise(premiumRaw) : null;
      return {
        rowNumber: idx + 1,
        clientFullName: getReq("clientFullName"),
        phone: get("phone"),
        email: get("email"),
        insurerName: getReq("insurerName"),
        insuranceType: getReq("insuranceType"),
        policyNumber: get("policyNumber"),
        startDate: get("startDate"),
        endDate: getReq("endDate"),
        premiumPaise,
        assignedToUserId: get("assignedToUserId")
      };
    });
  }, [rawRows, mapping]);

  const startImport = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep(3);
    const normalized = buildNormalizedRows();
    setProgress({ sent: 0, total: normalized.length, valid: 0, invalid: 0 });

    try {
      const createRes = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          fileName: file.name
        })
      });
      if (createRes.status === 401) {
        router.push("/login?from=/import");
        return;
      }
      if (!createRes.ok) {
        const d = (await createRes.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to create import");
        return;
      }
      const { id } = (await createRes.json()) as { id: string };
      setImportId(id);

      let valid = 0;
      let invalid = 0;
      for (let i = 0; i < normalized.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = normalized.slice(i, i + IMPORT_CHUNK_SIZE);
        const res = await fetch(`/api/imports/${id}/rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk })
        });
        if (res.status === 401) {
          router.push("/login?from=/import");
          return;
        }
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setError(d.error ?? "Chunk upload failed");
          return;
        }
        const data = (await res.json()) as {
          valid: number;
          invalid: number;
        };
        valid += data.valid;
        invalid += data.invalid;
        setProgress((p) => ({
          ...p,
          sent: Math.min(p.sent + chunk.length, p.total),
          valid,
          invalid
        }));
      }

      const commitRes = await fetch(`/api/imports/${id}/commit`, { method: "POST" });
      if (!commitRes.ok) {
        setError("Failed to commit import");
        return;
      }
      setImportDone(true);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }, [file, source, buildNormalizedRows, router]);

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/clients" className="text-primary hover:text-primary-light">Clients</Link>
        {" · "}
        <Link href="/policies" className="text-primary hover:text-primary-light">Policies</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Import policies</h1>

      {step === 1 && (
        <section className="mt-4">
          <p className="text-gray-600 mb-4">
            Upload a CSV or Excel file. You will map columns to fields in the next step.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="text-sm file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary-light"
          />
        </section>
      )}

      {step === 2 && rawRows.length > 0 && (
        <section className="mt-4">
          <p className="text-gray-700 mb-4">
            <strong>{rawRows.length}</strong> rows detected. Map file columns to fields (required: Client name, End date, Insurer name, Insurance type).
          </p>
          <button
            type="button"
            onClick={fetchUsers}
            className="mb-4 min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Load team (for assignee)
          </button>
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-card">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-900 border-b border-gray-200">Field</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900 border-b border-gray-200">File column</th>
                </tr>
              </thead>
              <tbody>
                {TARGET_FIELDS.map(({ key, label, required }) => (
                  <tr key={key} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-3 text-gray-700">
                      {label}
                      {required && " *"}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={mapping[key] ?? ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                        className="min-w-[140px] px-2 py-1.5 rounded border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">— Skip —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Preview: first row —{" "}
            {headers.slice(0, 5).map((h) => `${h}: ${rawRows[0]?.[h] ?? ""}`).join(", ")}
            {headers.length > 5 ? "…" : ""}
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={startImport}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
            >
              Start import
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-4">
          {error && (
            <p role="alert" className="mb-4 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          <p className="text-gray-700">
            Sending rows… {progress.sent} / {progress.total} · Valid: {progress.valid} · Invalid: {progress.invalid}
          </p>
          {importDone && <p className="mt-2 text-gray-600">Committing…</p>}
        </section>
      )}

      {step === 4 && importId && (
        <section className="mt-4">
          <p className="text-gray-700 font-medium">Import complete.</p>
          <p className="mt-2 text-gray-600">
            Total: {progress.total} · Success: {progress.valid} · Failed: {progress.invalid}
          </p>
          <p className="mt-4">
            <Link href={`/import/${importId}/errors`} className="text-primary hover:text-primary-light font-medium">
              View failed rows
            </Link>
          </p>
          <p className="mt-2">
            <Link href="/dashboard" className="text-primary hover:text-primary-light font-medium">
              Back to dashboard
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
