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

export default function NewClientPage() {
  const router = useRouter();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHouseholds = useCallback(async () => {
    setLoadingHouseholds(true);
    try {
      const res = await fetch("/api/households");
      if (res.status === 401) {
        router.push("/login?from=/clients/new");
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { households: Household[] };
        setHouseholds(data.households ?? []);
      }
    } finally {
      setLoadingHouseholds(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitLoading(true);
    try {
      const body: {
        fullName: string;
        phone?: string;
        email?: string;
        address?: string;
        notes?: string;
        householdId?: string | null;
      } = {
        fullName: fullName.trim()
      };
      if (phone.trim()) body.phone = phone.trim();
      if (email.trim()) body.email = email.trim();
      if (address.trim()) body.address = address.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (householdId.trim()) body.householdId = householdId.trim();
      else body.householdId = null;

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 401) {
        router.push("/login?from=/clients/new");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to create client.");
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/clients/${data.id}`);
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link> · <Link href="/clients">Clients</Link></p>
      <h1>Add client</h1>

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
            disabled={loadingHouseholds}
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
          {submitLoading ? "Creating…" : "Create client"}
        </button>
        <Link href="/clients" style={{ marginLeft: "0.5rem" }}>
          Cancel
        </Link>
      </form>
    </main>
  );
}
