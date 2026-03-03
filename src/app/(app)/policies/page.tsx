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
        offset: String(offset),
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
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Policies</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Policies</h1>
        <p className="mb-2">
          <Link href="/" className="text-primary hover:text-primary-light">
            Home
          </Link>{" "}
          ·{" "}
          <Link href="/policies" className="text-primary hover:text-primary-light">
            Policies
          </Link>
        </p>
        <p role="alert" className="text-red-600">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Policies</h1>

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All</option>
            {POLICY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        {users.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">Assigned to</span>
            <select
              value={assignedToFilter}
              onChange={(e) => {
                setAssignedToFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="mb-4">
        <Link
          href="/policies/new"
          className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Add policy
        </Link>
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-card">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Client
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Insurer
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Type
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Policy #
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                End date
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Status
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Assigned to
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                {" "}
              </th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="py-2.5 px-3 text-sm">
                  <Link
                    href={`/clients/${p.clientId}`}
                    className="text-primary hover:text-primary-light font-medium"
                  >
                    {p.clientFullName ?? p.clientId}
                  </Link>
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{p.insurerName}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{p.insuranceType}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{p.policyNumber ?? "—"}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{p.endDate}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">
                  {p.status.replace(/_/g, " ")}
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-700">
                  {p.assignedTo ? userNames[p.assignedTo] ?? p.assignedTo : "—"}
                </td>
                <td className="py-2.5 px-3 text-sm">
                  <Link
                    href={`/policies/${p.id}`}
                    className="text-primary hover:text-primary-light font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {policies.length === 0 && (
        <p className="mt-4 text-gray-500">No policies yet.</p>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages} ({total} total)
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
