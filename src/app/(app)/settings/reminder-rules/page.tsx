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
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Reminder rules</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (role !== "owner") {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Reminder rules</h1>
        <p role="alert" className="text-red-600">
          You don&apos;t have permission to manage reminder rules.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/settings/users" className="text-primary hover:text-primary-light">Team</Link>
        {" · "}
        <Link href="/settings/households" className="text-primary hover:text-primary-light">Households</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Reminder rules</h1>
      <p className="text-gray-600 mb-4">Choose how many days before policy expiry to create reminders.</p>

      {error && (
        <p role="alert" className="mb-4 text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50/50 shadow-card max-w-md">
        {saveError && (
          <p role="alert" className="mb-4 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {saveError}
          </p>
        )}
        <ul className="space-y-0">
          {PRESET_DAYS.map((days) => (
            <li key={days} className="py-3 border-b border-gray-200 last:border-0">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={enabled[days] !== false}
                  onChange={(e) =>
                    setEnabled((prev) => ({ ...prev, [days]: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                />
                <span className="text-sm text-gray-700">
                  {days} day{days !== 1 ? "s" : ""} before expiry
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
