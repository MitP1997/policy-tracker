"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;

type Client = {
  id: string;
  agencyId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  householdId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type Household = {
  id: string;
  agencyId: string;
  name: string;
  createdAt: string;
};

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search) params.set("q", search);
      const res = await fetch(`/api/clients?${params}`);
      if (res.status === 401) {
        router.push("/login?from=/clients");
        return;
      }
      if (!res.ok) {
        setError("Failed to load clients.");
        setClients([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as { clients: Client[]; total: number };
      setClients(data.clients ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [router, offset, search]);

  const fetchHouseholds = useCallback(async () => {
    try {
      const res = await fetch("/api/households");
      if (res.ok) {
        const data = (await res.json()) as { households: Household[] };
        setHouseholds(data.households ?? []);
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  const householdNames: Record<string, string> = {};
  for (const h of households) {
    householdNames[h.id] = h.name;
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setOffset(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  if (loading && clients.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Clients</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Clients</h1>
        <p role="alert" className="text-red-600">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Clients</h1>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2 flex-wrap">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, phone, email"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="submit"
          className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Search
        </button>
      </form>

      <p className="mb-4">
        <Link
          href="/clients/new"
          className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Add client
        </Link>
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-card">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Name
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Phone
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Email
              </th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                Household
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="py-2.5 px-3 text-sm">
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-primary hover:text-primary-light font-medium"
                  >
                    {client.fullName}
                  </Link>
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-700">
                  {client.phone ?? "—"}
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-700">
                  {client.email ?? "—"}
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-700">
                  {client.householdId
                    ? householdNames[client.householdId] ?? client.householdId
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {clients.length === 0 && (
        <p className="mt-4 text-gray-500">No clients yet.</p>
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
