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
        offset: String(offset)
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
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link></p>
      <h1>Clients</h1>

      <form onSubmit={handleSearchSubmit} style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, phone, email"
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button type="submit">Search</button>
      </form>

      <p style={{ marginBottom: "1rem" }}>
        <Link href="/clients/new">Add client</Link>
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Name</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Phone</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Email</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Household</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                <Link href={`/clients/${client.id}`}>{client.fullName}</Link>
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                {client.phone ?? "—"}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                {client.email ?? "—"}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                {client.householdId ? (householdNames[client.householdId] ?? client.householdId) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {clients.length === 0 && <p>No clients yet.</p>}

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
