"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ReminderItem = {
  id: string;
  policyId: string;
  clientId: string;
  dueOn: string;
  ruleDaysBefore: number;
  policyNumber: string | null;
  endDate: string;
  insurerName: string;
  insuranceType: string;
  clientFullName: string | null;
};

export default function RemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reminders/today");
      if (res.status === 401) {
        router.push("/login?from=/reminders");
        return;
      }
      if (!res.ok) {
        setError("Failed to load reminders.");
        setReminders([]);
        return;
      }
      const data = (await res.json()) as { reminders: ReminderItem[] };
      setReminders(data.reminders ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  async function handleDone(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/reminders/${id}/done`, { method: "POST" });
      if (res.ok) await fetchReminders();
    } finally {
      setActingId(null);
    }
  }

  async function handleDismiss(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/reminders/${id}/dismiss`, {
        method: "POST",
      });
      if (res.ok) await fetchReminders();
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          Today&apos;s reminders
        </h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">
        Today&apos;s reminders
      </h1>
      <p className="mb-6">
        <Link
          href="/dashboard"
          className="text-primary hover:text-primary-light font-medium"
        >
          Dashboard
        </Link>
      </p>

      {error && (
        <p role="alert" className="text-red-600 mb-4">
          {error}
        </p>
      )}

      {!error && reminders.length === 0 && (
        <p className="text-gray-500">No reminders due today.</p>
      )}

      {!error && reminders.length > 0 && (
        <ul className="space-y-0">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="py-4 px-3 border-b border-gray-200 last:border-0 hover:bg-gray-50/50 rounded-lg"
            >
              <div className="text-sm text-gray-700">
                <Link
                  href={`/policies/${r.policyId}`}
                  className="font-medium text-primary hover:text-primary-light"
                >
                  {r.clientFullName ?? "—"}
                </Link>
                {" · "}
                {r.insurerName}
                {r.policyNumber ? ` · ${r.policyNumber}` : ""}
                {" · "}
                ends {r.endDate}
                {" · "}
                {r.ruleDaysBefore} day{r.ruleDaysBefore !== 1 ? "s" : ""} before
                expiry
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={actingId === r.id}
                  onClick={() => handleDone(r.id)}
                  className="min-h-[44px] px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Mark done
                </button>
                <button
                  type="button"
                  disabled={actingId === r.id}
                  onClick={() => handleDismiss(r.id)}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
