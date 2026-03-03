"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Household = {
  id: string;
  agencyId: string;
  name: string;
  createdAt: string;
};

export default function SettingsHouseholdsPage() {
  const router = useRouter();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addName, setAddName] = useState("");

  const fetchHouseholds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/households");
      if (res.status === 401) {
        router.push("/login?from=/settings/households");
        return;
      }
      if (!res.ok) {
        setError("Failed to load households.");
        setHouseholds([]);
        return;
      }
      const data = (await res.json()) as { households: Household[] };
      setHouseholds(data.households ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  async function handleAddHousehold(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim() })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        setAddError(data.error ?? "A household with this name already exists.");
        return;
      }
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add household.");
        return;
      }
      setAddName("");
      setShowAddForm(false);
      await fetchHouseholds();
    } finally {
      setAddLoading(false);
    }
  }

  const fieldClass =
    "block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Households</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="mb-2">
          <Link href="/settings/users" className="text-primary hover:text-primary-light">Team</Link>
          {" · "}
          <Link href="/settings/reminder-rules" className="text-primary hover:text-primary-light">Reminder rules</Link>
        </p>
        <p role="alert" className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/settings/users" className="text-primary hover:text-primary-light">Team</Link>
        {" · "}
        <Link href="/settings/reminder-rules" className="text-primary hover:text-primary-light">Reminder rules</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Households</h1>

      {showAddForm ? (
        <form onSubmit={handleAddHousehold} className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50/50 shadow-card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Add household</h2>
          {addError && (
            <p role="alert" className="mb-4 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              {addError}
            </p>
          )}
          <div className="space-y-4 max-w-md">
            <div>
              <label htmlFor="add-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="add-name"
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
                className={fieldClass}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="submit"
                disabled={addLoading}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-60 transition-colors"
              >
                {addLoading ? "Adding…" : "Add household"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mb-6 min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Add household
        </button>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Name</th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Created</th>
            </tr>
          </thead>
          <tbody>
            {households.map((h) => (
              <tr key={h.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="py-2.5 px-3 text-sm text-gray-700">{h.name}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{h.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {households.length === 0 && <p className="mt-4 text-gray-500">No households yet.</p>}
    </div>
  );
}
