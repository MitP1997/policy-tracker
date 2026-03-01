"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const POLICY_STATUSES = [
  "active",
  "renewal_in_progress",
  "renewed",
  "lost",
  "expired"
] as const;

type Props = {
  policyId: string;
  currentStatus: string;
};

export function QuickStatusSelect({ policyId, currentStatus }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (!newStatus) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.status === 401) {
        router.push(`/login?from=/dashboard`);
        return;
      }
      if (res.ok) {
        setValue(newStatus);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={loading}
      aria-label="Renewal status"
      style={{ marginLeft: "0.5rem", padding: "0.2rem 0.25rem" }}
    >
      {POLICY_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
