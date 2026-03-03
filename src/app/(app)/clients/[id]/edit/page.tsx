"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

type Client = {
  id: string;
  agencyId: string;
  fullName: string;
  phone: string | null;
  callingNumber: string | null;
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
  const [callingNumber, setCallingNumber] = useState("");
  const [callingSameAsWhatsApp, setCallingSameAsWhatsApp] = useState(true);
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
      const ph = data.phone ?? "";
      const cn = data.callingNumber ?? ph;
      setCallingNumber(cn);
      setCallingSameAsWhatsApp(ph === cn || !cn);
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
        callingNumber?: string | null;
        email?: string | null;
        address?: string | null;
        notes?: string | null;
        householdId?: string | null;
      } = {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        callingNumber: callingSameAsWhatsApp
          ? (phone.trim() || null)
          : (callingNumber.trim() || null),
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

  const fieldClass =
    "block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

  if (loading && !client) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Edit client</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div>
        <p className="mb-2">
          <Link href="/clients" className="text-primary hover:text-primary-light">Clients</Link>
          {" · "}
          <Link href={`/clients/${id}`} className="text-primary hover:text-primary-light">Client</Link>
        </p>
        <p role="alert" className="text-red-600">{error ?? "Client not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/clients" className="text-primary hover:text-primary-light">Clients</Link>
        {" · "}
        <Link href={`/clients/${id}`} className="text-primary hover:text-primary-light">{client.fullName}</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Edit client</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && (
          <p role="alert" className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              id="callingSameAsWhatsApp"
              type="checkbox"
              checked={callingSameAsWhatsApp}
              onChange={(e) => setCallingSameAsWhatsApp(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="callingSameAsWhatsApp" className="text-sm font-medium text-gray-700">
              Same as WhatsApp number
            </label>
          </div>
          {!callingSameAsWhatsApp && (
            <div>
              <label htmlFor="callingNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Calling number
              </label>
              <input
                id="callingNumber"
                type="tel"
                value={callingNumber}
                onChange={(e) => setCallingNumber(e.target.value)}
                className={fieldClass}
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="householdId" className="block text-sm font-medium text-gray-700 mb-1">Household</label>
          <select
            id="householdId"
            value={householdId}
            onChange={(e) => setHouseholdId(e.target.value)}
            className={fieldClass}
          >
            <option value="">— None —</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
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
            {submitLoading ? "Saving…" : "Save"}
          </button>
          <Link
            href={`/clients/${id}`}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
