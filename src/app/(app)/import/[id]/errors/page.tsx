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
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/import" className="text-primary hover:text-primary-light">Import</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Import errors</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      {error && (
        <p role="alert" className="text-red-600 mb-4">
          {error}
        </p>
      )}
      {!loading && !error && errors.length === 0 && (
        <p className="text-gray-600">No failed rows for this import.</p>
      )}
      {!loading && errors.length > 0 && (
        <div className="overflow-x-auto mt-4 rounded-lg border border-gray-200 shadow-card">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-2.5 px-3 font-medium text-gray-900 border-b border-gray-200">Row</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-900 border-b border-gray-200">Error</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-900 border-b border-gray-200">Raw data</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.rowNumber} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="py-2 px-3 text-gray-700">{e.rowNumber}</td>
                  <td className="py-2 px-3 text-gray-700">{e.errorMessage}</td>
                  <td className="py-2 px-3 text-gray-600 max-w-[300px]">
                    {e.rawRow ? (
                      <pre className="m-0 text-xs overflow-auto">
                        {JSON.stringify(e.rawRow, null, 0).slice(0, 200)}
                        {JSON.stringify(e.rawRow).length > 200 ? "…" : ""}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4">
        <Link href="/import" className="text-primary hover:text-primary-light font-medium">
          New import
        </Link>
      </p>
    </div>
  );
}
