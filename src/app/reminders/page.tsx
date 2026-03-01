"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

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
        method: "POST"
      });
      if (res.ok) await fetchReminders();
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/dashboard">Dashboard</Link></p>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <h1>Today&apos;s reminders</h1>
        <LogoutButton />
      </header>
      <p>
        <Link href="/dashboard">Dashboard</Link>
      </p>

      {error && (
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      )}

      {!error && reminders.length === 0 && (
        <p>No reminders due today.</p>
      )}

      {!error && reminders.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {reminders.map((r) => (
            <li
              key={r.id}
              style={{
                padding: "0.75rem 0",
                borderBottom: "1px solid #eee"
              }}
            >
              <div>
                <Link href={`/policies/${r.policyId}`}>
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
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  disabled={actingId === r.id}
                  onClick={() => handleDone(r.id)}
                  style={{ marginRight: "0.5rem" }}
                >
                  Mark done
                </button>
                <button
                  type="button"
                  disabled={actingId === r.id}
                  onClick={() => handleDismiss(r.id)}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
