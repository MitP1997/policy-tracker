"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POLICY_STATUSES = ["active", "renewal_in_progress", "renewed", "lost", "expired"] as const;

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

type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
};

export default function NewPolicyPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientId, setClientId] = useState("");
  const [insuranceType, setInsuranceType] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [premiumRupees, setPremiumRupees] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients?limit=500");
      if (res.status === 401) {
        router.push("/login?from=/policies/new");
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { clients: Client[] };
        setClients(data.clients ?? []);
      }
    } finally {
      setLoadingClients(false);
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.status === 401) {
        router.push("/login?from=/policies/new");
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { users: User[] };
        setUsers(data.users ?? []);
      }
    } catch {
      // 403 for staff - no assignee dropdown
    }
  }, [router]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clientIdTrim = clientId.trim();
    const insuranceTypeTrim = insuranceType.trim();
    const insurerNameTrim = insurerName.trim();
    const endDateTrim = endDate.trim();

    if (!clientIdTrim) {
      setError("Client is required.");
      return;
    }
    if (!insuranceTypeTrim) {
      setError("Insurance type is required.");
      return;
    }
    if (!insurerNameTrim) {
      setError("Insurer name is required.");
      return;
    }
    if (!endDateTrim || !/^\d{4}-\d{2}-\d{2}$/.test(endDateTrim)) {
      setError("End date is required and must be YYYY-MM-DD.");
      return;
    }

    setSubmitLoading(true);
    try {
      const body: {
        clientId: string;
        insuranceType: string;
        insurerName: string;
        policyNumber?: string | null;
        startDate?: string | null;
        endDate: string;
        premiumPaise?: number | null;
        status: string;
        assignedTo?: string | null;
        notes?: string | null;
      } = {
        clientId: clientIdTrim,
        insuranceType: insuranceTypeTrim,
        insurerName: insurerNameTrim,
        endDate: endDateTrim,
        status
      };
      if (policyNumber.trim()) body.policyNumber = policyNumber.trim();
      else body.policyNumber = null;
      if (startDate.trim() && /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
        body.startDate = startDate.trim();
      } else {
        body.startDate = null;
      }
      const rupees = parseFloat(premiumRupees);
      if (!Number.isNaN(rupees) && rupees >= 0) {
        body.premiumPaise = Math.round(rupees * 100);
      } else {
        body.premiumPaise = null;
      }
      if (assignedTo.trim()) body.assignedTo = assignedTo.trim();
      else body.assignedTo = null;
      if (notes.trim()) body.notes = notes.trim();
      else body.notes = null;

      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 401) {
        router.push("/login?from=/policies/new");
        return;
      }
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Policy number already exists in this agency.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to create policy.");
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/policies/${data.id}`);
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link> · <Link href="/policies">Policies</Link></p>
      <h1>Add policy</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        {error && (
          <p role="alert" style={{ color: "var(--color-error, #c00)", marginBottom: "0.75rem" }}>
            {error}
          </p>
        )}
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="clientId">Client *</label>
          <select
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
            disabled={loadingClients}
          >
            <option value="">— Select client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="insuranceType">Insurance type *</label>
          <input
            id="insuranceType"
            type="text"
            value={insuranceType}
            onChange={(e) => setInsuranceType(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="insurerName">Insurer name *</label>
          <input
            id="insurerName"
            type="text"
            value={insurerName}
            onChange={(e) => setInsurerName(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="policyNumber">Policy number</label>
          <input
            id="policyNumber"
            type="text"
            value={policyNumber}
            onChange={(e) => setPolicyNumber(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="startDate">Start date (YYYY-MM-DD)</label>
          <input
            id="startDate"
            type="text"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="endDate">End date (YYYY-MM-DD) *</label>
          <input
            id="endDate"
            type="text"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            placeholder="YYYY-MM-DD"
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="premiumRupees">Premium (₹)</label>
          <input
            id="premiumRupees"
            type="number"
            min="0"
            step="0.01"
            value={premiumRupees}
            onChange={(e) => setPremiumRupees(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          >
            {POLICY_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        {users.length > 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="assignedTo">Assigned to</label>
            <select
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            >
              <option value="">— None —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
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
          {submitLoading ? "Creating…" : "Create policy"}
        </button>
        <Link href="/policies" style={{ marginLeft: "0.5rem" }}>
          Cancel
        </Link>
      </form>
    </main>
  );
}
