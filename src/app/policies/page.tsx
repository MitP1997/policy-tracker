"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;
const POLICY_STATUSES = ["active", "renewal_in_progress", "renewed", "lost", "expired"] as const;

type Policy = {
  id: string;
  agencyId: string;
  clientId: string;
  insuranceType: string;
  insurerName: string;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string;
  premiumPaise: number | null;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  clientFullName?: string;
};

type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
};

export default function PoliciesPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset)
      });
      if (statusFilter) params.set("status", statusFilter);
      if (assignedToFilter) params.set("assigned_to", assignedToFilter);
      const res = await fetch(`/api/policies?${params}`);
      if (res.status === 401) {
        router.push("/login?from=/policies");
        return;
      }
      if (!res.ok) {
        setError("Failed to load policies.");
        setPolicies([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as { policies: Policy[]; total: number };
      setPolicies(data.policies ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [router, offset, statusFilter, assignedToFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.status === 401) {
        router.push("/login?from=/policies");
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { users: User[] };
        setUsers(data.users ?? []);
      }
    } catch {
      // non-blocking; 403 means staff, no assignee filter
    }
  }, [router]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const userNames: Record<string, string> = {};
  for (const u of users) {
    userNames[u.id] = u.name;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  if (loading && policies.length === 0) {
    return (
      <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link> · <Link href="/policies">Policies</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link></p>
      <h1>Policies</h1>

      <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label>
          Status{" "}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            style={{ padding: "0.5rem" }}
          >
            <option value="">All</option>
            {POLICY_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        {users.length > 0 && (
          <label>
            Assigned to{" "}
            <select
              value={assignedToFilter}
              onChange={(e) => {
                setAssignedToFilter(e.target.value);
                setOffset(0);
              }}
              style={{ padding: "0.5rem" }}
            >
              <option value="">All</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p style={{ marginBottom: "1rem" }}>
        <Link href="/policies/new">Add policy</Link>
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Client</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Insurer</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Type</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Policy #</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>End date</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Status</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Assigned to</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}></th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                <Link href={`/clients/${p.clientId}`}>
                  {p.clientFullName ?? p.clientId}
                </Link>
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{p.insurerName}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{p.insuranceType}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{p.policyNumber ?? "—"}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{p.endDate}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{p.status.replace(/_/g, " ")}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                {p.assignedTo ? (userNames[p.assignedTo] ?? p.assignedTo) : "—"}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                <Link href={`/policies/${p.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {policies.length === 0 && <p>No policies yet.</p>}

      {total > PAGE_SIZE && (
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages} ({total} total)
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
