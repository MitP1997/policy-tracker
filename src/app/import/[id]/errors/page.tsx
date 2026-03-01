"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

type ErrorRow = {
  rowNumber: number;
  errorMessage: string;
  rawRow?: Record<string, unknown>;
};

export default function ImportErrorsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchErrors = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${id}/errors`);
      if (res.status === 401) {
        router.push(`/login?from=/import/${id}/errors`);
        return;
      }
      if (!res.ok) {
        setError("Failed to load errors");
        setErrors([]);
        return;
      }
      const data = (await res.json()) as { errors: ErrorRow[] };
      setErrors(data.errors ?? []);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/">Home</Link> · <Link href="/import">Import</Link>
      </p>
      <h1>Import errors</h1>
      {loading && <p>Loading…</p>}
      {error && (
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      )}
      {!loading && !error && errors.length === 0 && (
        <p>No failed rows for this import.</p>
      )}
      {!loading && errors.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", border: "1px solid #ccc" }}>
                  Row
                </th>
                <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", border: "1px solid #ccc" }}>
                  Error
                </th>
                <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", border: "1px solid #ccc" }}>
                  Raw data
                </th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.rowNumber}>
                  <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ccc" }}>
                    {e.rowNumber}
                  </td>
                  <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ccc" }}>
                    {e.errorMessage}
                  </td>
                  <td style={{ padding: "0.35rem 0.5rem", border: "1px solid #ccc", maxWidth: 300 }}>
                    {e.rawRow
                      ? (
                          <pre style={{ margin: 0, fontSize: "0.8rem", overflow: "auto" }}>
                            {JSON.stringify(e.rawRow, null, 0).slice(0, 200)}
                            {JSON.stringify(e.rawRow).length > 200 ? "…" : ""}
                          </pre>
                        )
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: "1rem" }}>
        <Link href="/import">New import</Link>
      </p>
    </main>
  );
}
