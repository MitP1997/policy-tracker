"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
};

export default function SettingsUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (res.status === 401) {
        router.push("/login?from=/settings/users");
        return;
      }
      if (res.status === 403) {
        setError("You don't have permission to manage users.");
        setUsers([]);
        return;
      }
      if (!res.ok) {
        setError("Failed to load users.");
        setUsers([]);
        return;
      }
      const data = (await res.json()) as { users: User[] };
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), phone: addPhone.trim() })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        setAddError(data.error ?? "User with this phone already exists.");
        return;
      }
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add user.");
        return;
      }
      setAddName("");
      setAddPhone("");
      setShowAddForm(false);
      await fetchUsers();
    } finally {
      setAddLoading(false);
    }
  }

  async function handleToggleStatus(user: User) {
    const nextStatus = user.status === "active" ? "disabled" : "active";
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) await fetchUsers();
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/settings/reminder-rules">Reminder rules</Link>
        {" · "}
        <Link href="/settings/households">Households</Link>
      </p>
      <h1>Team</h1>

      {showAddForm ? (
        <form
          onSubmit={handleAddUser}
          style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #ccc" }}
        >
          <h2 style={{ marginTop: 0 }}>Add user</h2>
          {addError && (
            <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
              {addError}
            </p>
          )}
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="add-name">Name</label>
            <input
              id="add-name"
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="add-phone">Phone (E.164)</label>
            <input
              id="add-phone"
              type="tel"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              placeholder="+919876543210"
              required
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </div>
          <button type="submit" disabled={addLoading}>
            {addLoading ? "Adding…" : "Add user"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setAddError(null);
            }}
            style={{ marginLeft: "0.5rem" }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          style={{ marginBottom: "1.5rem" }}
        >
          Add user
        </button>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Name</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Phone</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Role</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Status</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Last login</th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #333" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{user.name}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{user.phone}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{user.role}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>{user.status}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                {user.last_login_at ?? "—"}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                <button
                  type="button"
                  disabled={togglingId === user.id}
                  onClick={() => handleToggleStatus(user)}
                >
                  {user.status === "active" ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p>No users yet.</p>}
    </main>
  );
}
