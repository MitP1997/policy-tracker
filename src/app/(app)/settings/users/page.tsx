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

  const fieldClass =
    "block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Team</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Team</h1>
        <p role="alert" className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/settings/reminder-rules" className="text-primary hover:text-primary-light">Reminder rules</Link>
        {" · "}
        <Link href="/settings/households" className="text-primary hover:text-primary-light">Households</Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Team</h1>

      {showAddForm ? (
        <form onSubmit={handleAddUser} className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50/50 shadow-card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Add user</h2>
          {addError && (
            <p role="alert" className="mb-4 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              {addError}
            </p>
          )}
          <div className="space-y-4 max-w-md">
            <div>
              <label htmlFor="add-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="add-name"
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="add-phone" className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
              <input
                id="add-phone"
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+919876543210"
                required
                className={fieldClass}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="submit"
                disabled={addLoading}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-60 transition-colors"
              >
                {addLoading ? "Adding…" : "Add user"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mb-6 min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Add user
        </button>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-card">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Name</th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">WhatsApp number</th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Role</th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Status</th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Last login</th>
              <th className="text-left py-3 px-3 text-sm font-medium text-gray-900 border-b border-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="py-2.5 px-3 text-sm text-gray-700">{user.name}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{user.phone}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{user.role}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{user.status}</td>
                <td className="py-2.5 px-3 text-sm text-gray-700">{user.last_login_at ?? "—"}</td>
                <td className="py-2.5 px-3 text-sm">
                  <button
                    type="button"
                    disabled={togglingId === user.id}
                    onClick={() => handleToggleStatus(user)}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {user.status === "active" ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="mt-4 text-gray-500">No users yet.</p>}
    </div>
  );
}
