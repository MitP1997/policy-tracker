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

  const fieldClass =
    "block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60";

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/policies" className="text-primary hover:text-primary-light">Policies</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Add policy</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && (
          <p role="alert" className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          <select
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            disabled={loadingClients}
            className={fieldClass}
          >
            <option value="">— Select client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="insuranceType" className="block text-sm font-medium text-gray-700 mb-1">Insurance type *</label>
          <input
            id="insuranceType"
            type="text"
            value={insuranceType}
            onChange={(e) => setInsuranceType(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="insurerName" className="block text-sm font-medium text-gray-700 mb-1">Insurer name *</label>
          <input
            id="insurerName"
            type="text"
            value={insurerName}
            onChange={(e) => setInsurerName(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="policyNumber" className="block text-sm font-medium text-gray-700 mb-1">Policy number</label>
          <input
            id="policyNumber"
            type="text"
            value={policyNumber}
            onChange={(e) => setPolicyNumber(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start date (YYYY-MM-DD)</label>
          <input
            id="startDate"
            type="text"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End date (YYYY-MM-DD) *</label>
          <input
            id="endDate"
            type="text"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            placeholder="YYYY-MM-DD"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="premiumRupees" className="block text-sm font-medium text-gray-700 mb-1">Premium (₹)</label>
          <input
            id="premiumRupees"
            type="number"
            min="0"
            step="0.01"
            value={premiumRupees}
            onChange={(e) => setPremiumRupees(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={fieldClass}
          >
            {POLICY_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        {users.length > 0 && (
          <div>
            <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-1">Assigned to</label>
            <select
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={fieldClass}
            >
              <option value="">— None —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={fieldClass}
          />
        </div>
        <div className="flex gap-2 flex-wrap pt-2">
          <button
            type="submit"
            disabled={submitLoading}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {submitLoading ? "Creating…" : "Create policy"}
          </button>
          <Link
            href="/policies"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
