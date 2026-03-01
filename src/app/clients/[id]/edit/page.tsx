"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

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

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [client, setClient] = useState<Client | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.status === 401) {
        router.push(`/login?from=/clients/${id}/edit`);
        return;
      }
      if (res.status === 404 || !res.ok) {
        setError("Client not found.");
        setClient(null);
        return;
      }
      const data = (await res.json()) as Client;
      setClient(data);
      setFullName(data.fullName);
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      setAddress(data.address ?? "");
      setNotes(data.notes ?? "");
      setHouseholdId(data.householdId ?? "");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

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
    fetchClient();
  }, [fetchClient]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setError(null);
    setSubmitLoading(true);
    try {
      const body: {
        fullName?: string;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        notes?: string | null;
        householdId?: string | null;
      } = {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        householdId: householdId.trim() || null
      };

      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 401) {
        router.push(`/login?from=/clients/${id}/edit`);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to update client.");
        return;
      }
      router.push(`/clients/${id}`);
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading && !client) {
    return (
      <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link> · <Link href="/clients">Clients</Link> · <Link href={`/clients/${id}`}>Client</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error ?? "Client not found."}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link> · <Link href="/clients">Clients</Link> · <Link href={`/clients/${id}`}>{client.fullName}</Link></p>
      <h1>Edit client</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        {error && (
          <p role="alert" style={{ color: "var(--color-error, #c00)", marginBottom: "0.75rem" }}>
            {error}
          </p>
        )}
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="fullName">Full name *</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="address">Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="householdId">Household</label>
          <select
            id="householdId"
            value={householdId}
            onChange={(e) => setHouseholdId(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          >
            <option value="">— None —</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <button type="submit" disabled={submitLoading}>
          {submitLoading ? "Saving…" : "Save"}
        </button>
        <Link href={`/clients/${id}`} style={{ marginLeft: "0.5rem" }}>
          Cancel
        </Link>
      </form>
    </main>
  );
}
