"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

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

export default function EditPolicyPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [insuranceType, setInsuranceType] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [premiumRupees, setPremiumRupees] = useState("");
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/policies/${id}`);
      if (res.status === 401) {
        router.push(`/login?from=/policies/${id}/edit`);
        return;
      }
      if (res.status === 403 || res.status === 404 || !res.ok) {
        setError("Policy not found or you don't have access.");
        setPolicy(null);
        return;
      }
      const data = (await res.json()) as Policy;
      setPolicy(data);
      setClientId(data.clientId);
      setInsuranceType(data.insuranceType);
      setInsurerName(data.insurerName);
      setPolicyNumber(data.policyNumber ?? "");
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate);
      setPremiumRupees(
        data.premiumPaise != null ? String(data.premiumPaise / 100) : ""
      );
      setStatus(data.status);
      setAssignedTo(data.assignedTo ?? "");
      setNotes(data.notes ?? "");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients?limit=500");
      if (res.ok) {
        const data = (await res.json()) as { clients: Client[] };
        setClients(data.clients ?? []);
      }
    } catch {
      // non-blocking
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = (await res.json()) as { users: User[] };
        setUsers(data.users ?? []);
      }
    } catch {
      // 403 for staff
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!policy) return;
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
      setError("End date must be YYYY-MM-DD.");
      return;
    }

    setSubmitLoading(true);
    try {
      const body: Record<string, unknown> = {
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

      const res = await fetch(`/api/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 401) {
        router.push(`/login?from=/policies/${id}/edit`);
        return;
      }
      if (res.status === 403) {
        setError("You don't have permission to edit this policy.");
        return;
      }
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Policy number already exists in this agency.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to update policy.");
        return;
      }
      router.push(`/policies/${id}`);
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading && !policy) {
    return (
      <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !policy) {
    return (
      <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link> · <Link href="/policies">Policies</Link> · <Link href={`/policies/${id}`}>Policy</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error ?? "Policy not found."}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link> · <Link href="/policies">Policies</Link> · <Link href={`/policies/${id}`}>{policy.clientFullName ?? "Policy"}</Link></p>
      <h1>Edit policy</h1>

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
          >
            <option value="">— Select client —</option>
            {(() => {
              const byId = new Map(clients.map((c) => [c.id, c]));
              if (policy && clientId && !byId.has(clientId)) {
                byId.set(clientId, {
                  id: clientId,
                  fullName: policy.clientFullName ?? clientId,
                  agencyId: policy.agencyId,
                  phone: null,
                  email: null,
                  address: null,
                  notes: null,
                  householdId: null,
                  createdBy: null,
                  createdAt: "",
                  updatedAt: ""
                });
              }
              return Array.from(byId.values()).map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ));
            })()}
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
          {submitLoading ? "Saving…" : "Save"}
        </button>
        <Link href={`/policies/${id}`} style={{ marginLeft: "0.5rem" }}>
          Cancel
        </Link>
      </form>
    </main>
  );
}
