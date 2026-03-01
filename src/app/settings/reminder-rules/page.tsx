"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PRESET_DAYS = [30, 15, 7, 1];

type Rule = {
  id: string;
  daysBefore: number;
  enabled: number;
};

export default function SettingsReminderRulesPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<number, boolean>>({
    30: true,
    15: true,
    7: true,
    1: true
  });

  const fetchMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.status === 401) {
      router.push("/login?from=/settings/reminder-rules");
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { role?: string };
    return data.role ?? null;
  }, [router]);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/settings/reminder-rules");
    if (res.status === 401) {
      router.push("/login?from=/settings/reminder-rules");
      return [];
    }
    if (res.status === 403) return [];
    if (!res.ok) return [];
    const data = (await res.json()) as { rules: Rule[] };
    return data.rules ?? [];
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchMe(), fetchRules()])
      .then(([r, ruleList]) => {
        if (cancelled) return;
        setRole(r ?? null);
        setRules(ruleList);
        const next: Record<number, boolean> = {};
        for (const d of PRESET_DAYS) {
          const rule = ruleList.find((x) => x.daysBefore === d);
          next[d] = rule ? rule.enabled === 1 : true;
        }
        setEnabled(next);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMe, fetchRules]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const rulesPayload = PRESET_DAYS.map((daysBefore) => ({
        daysBefore,
        enabled: enabled[daysBefore] !== false
      }));
      const res = await fetch("/api/settings/reminder-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesPayload })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 403) {
        setSaveError("You don't have permission to change reminder rules.");
        return;
      }
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save.");
        return;
      }
      const updated = (data as { rules?: Rule[] }).rules ?? [];
      setRules(updated);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/dashboard">Home</Link></p>
        <p>Loading…</p>
      </main>
    );
  }

  if (role !== "owner") {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/dashboard">Home</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          You don&apos;t have permission to manage reminder rules.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/dashboard">Home</Link>
        {" · "}
        <Link href="/settings/users">Team</Link>
        {" · "}
        <Link href="/settings/households">Households</Link>
      </p>
      <h1>Reminder rules</h1>
      <p>Choose how many days before policy expiry to create reminders.</p>

      {error && (
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ccc" }}
      >
        {saveError && (
          <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
            {saveError}
          </p>
        )}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {PRESET_DAYS.map((days) => (
            <li
              key={days}
              style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={enabled[days] !== false}
                  onChange={(e) =>
                    setEnabled((prev) => ({ ...prev, [days]: e.target.checked }))
                  }
                />
                {days} day{days !== 1 ? "s" : ""} before expiry
              </label>
            </li>
          ))}
        </ul>
        <button type="submit" disabled={saving} style={{ marginTop: "1rem" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </main>
  );
}
