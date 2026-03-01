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

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p>
          <Link href="/">Home</Link>
          {" · "}
          <Link href="/settings/users">Team</Link>
          {" · "}
          <Link href="/settings/reminder-rules">Reminder rules</Link>
        </p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/settings/users">Team</Link>
        {" · "}
        <Link href="/settings/reminder-rules">Reminder rules</Link>
      </p>
      <h1>Households</h1>

      {showAddForm ? (
        <form
          onSubmit={handleAddHousehold}
          style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #ccc" }}
        >
          <h2 style={{ marginTop: 0 }}>Add household</h2>
          {addError && (
            <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
              {addError}
            </p>
          )}
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="add-name">Name</label>
            <input
              id="add-name"
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </div>
          <button type="submit" disabled={addLoading}>
            {addLoading ? "Adding…" : "Add household"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setAddError(null);
            }}
            style={{ marginLeft: "0.5rem" }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          style={{ marginBottom: "1.5rem" }}
        >
          Add household
        </button>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Name</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {households.map((h) => (
            <tr key={h.id}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{h.name}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{h.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {households.length === 0 && <p>No households yet.</p>}
    </main>
  );
}
