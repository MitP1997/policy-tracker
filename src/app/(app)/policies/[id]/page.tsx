"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

const POLICY_STATUSES = ["active", "renewal_in_progress", "renewed", "lost", "expired"] as const;

const inputClass =
  "block w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60";

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

type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
};

type Document = {
  id: string;
  fileName: string;
  docType: string;
  fileSize: number | null;
  createdAt: string;
};

export default function PolicyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchPolicy = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/policies/${id}`);
      if (res.status === 401) {
        router.push(`/login?from=/policies/${id}`);
        return;
      }
      if (res.status === 403) {
        setError("You don't have access to this policy.");
        setPolicy(null);
        return;
      }
      if (res.status === 404 || !res.ok) {
        setError("Policy not found.");
        setPolicy(null);
        return;
      }
      const data = (await res.json()) as Policy;
      setPolicy(data);
      setStatusValue(data.status);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = (await res.json()) as { users: User[] };
        setUsers(data.users ?? []);
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?policy_id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = (await res.json()) as { documents: Document[] };
        setDocuments(data.documents ?? []);
      } else {
        setDocuments([]);
      }
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (policy) fetchDocuments();
  }, [policy, fetchDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !policy) return;
    setUploadError(null);
    setUploadLoading(true);
    try {
      const uploadUrlRes = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: id,
          clientId: policy.clientId,
          docType: "policy_document",
          fileName: file.name,
        }),
      });
      if (uploadUrlRes.status === 401) {
        router.push(`/login?from=/policies/${id}`);
        return;
      }
      if (!uploadUrlRes.ok) {
        const err = (await uploadUrlRes.json()) as { error?: string };
        setUploadError(err.error ?? "Failed to get upload URL");
        return;
      }
      const { storageKey, uploadUrl } = (await uploadUrlRes.json()) as {
        storageKey: string;
        uploadUrl: string;
      };
      const form = new FormData();
      form.append("storageKey", storageKey);
      form.append("file", file);
      const uploadRes = await fetch(
        uploadUrl.startsWith("http") ? uploadUrl : "/api/documents/upload",
        { method: "POST", body: form }
      );
      if (!uploadRes.ok) {
        const err = (await uploadRes.json()) as { error?: string };
        setUploadError(err.error ?? "Upload failed");
        return;
      }
      const createRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          fileName: file.name,
          mimeType: file.type || null,
          fileSize: file.size,
          docType: "policy_document",
          policyId: id,
          clientId: policy.clientId,
        }),
      });
      if (createRes.status === 401) {
        router.push(`/login?from=/policies/${id}`);
        return;
      }
      if (!createRes.ok) {
        const err = (await createRes.json()) as { error?: string };
        setUploadError(err.error ?? "Failed to save document");
        return;
      }
      await fetchDocuments();
      e.target.value = "";
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (!policy || !newStatus) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/policies/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.status === 401) {
        router.push(`/login?from=/policies/${id}`);
        return;
      }
      if (res.ok) {
        setStatusValue(newStatus);
        setPolicy((p) => (p ? { ...p, status: newStatus } : null));
      }
    } finally {
      setStatusLoading(false);
    }
  }

  const userNames: Record<string, string> = {};
  for (const u of users) {
    userNames[u.id] = u.name;
  }

  if (loading && !policy) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Policy</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div>
        <p className="mb-2">
          <Link href="/policies" className="text-primary hover:text-primary-light">
            Policies
          </Link>
        </p>
        <p role="alert" className="text-red-600">
          {error ?? "Policy not found."}
        </p>
      </div>
    );
  }

  const premiumRupees =
    policy.premiumPaise != null ? (policy.premiumPaise / 100).toFixed(2) : null;

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/policies" className="text-primary hover:text-primary-light">
          Policies
        </Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Policy</h1>
      <p className="mb-6">
        <Link
          href={`/policies/${id}/edit`}
          className="text-primary hover:text-primary-light font-medium"
        >
          Edit
        </Link>
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="font-medium text-gray-700">Client</dt>
        <dd>
          <Link
            href={`/clients/${policy.clientId}`}
            className="text-primary hover:text-primary-light"
          >
            {policy.clientFullName ?? policy.clientId}
          </Link>
        </dd>
        <dt className="font-medium text-gray-700">Insurance type</dt>
        <dd className="text-gray-900">{policy.insuranceType}</dd>
        <dt className="font-medium text-gray-700">Insurer</dt>
        <dd className="text-gray-900">{policy.insurerName}</dd>
        <dt className="font-medium text-gray-700">Policy number</dt>
        <dd className="text-gray-900">{policy.policyNumber ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Start date</dt>
        <dd className="text-gray-900">{policy.startDate ?? "—"}</dd>
        <dt className="font-medium text-gray-700">End date</dt>
        <dd className="text-gray-900">{policy.endDate}</dd>
        <dt className="font-medium text-gray-700">Premium</dt>
        <dd className="text-gray-900">
          {premiumRupees != null ? `₹ ${premiumRupees}` : "—"}
        </dd>
        <dt className="font-medium text-gray-700">Status</dt>
        <dd>
          <select
            value={statusValue}
            onChange={handleStatusChange}
            disabled={statusLoading}
            className={`${inputClass} w-auto max-w-[200px]`}
          >
            {POLICY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </dd>
        <dt className="font-medium text-gray-700">Assigned to</dt>
        <dd className="text-gray-900">
          {policy.assignedTo ? userNames[policy.assignedTo] ?? policy.assignedTo : "—"}
        </dd>
        <dt className="font-medium text-gray-700">Notes</dt>
        <dd className="text-gray-900">{policy.notes ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Status updated</dt>
        <dd className="text-gray-900">{policy.statusUpdatedAt ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Created</dt>
        <dd className="text-gray-900">{policy.createdAt}</dd>
        <dt className="font-medium text-gray-700">Updated</dt>
        <dd className="text-gray-900">{policy.updatedAt}</dd>
      </dl>

      <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">Documents</h2>
      {uploadError && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {uploadError}
        </p>
      )}
      <p className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">Upload document:</span>
          <input
            type="file"
            disabled={uploadLoading}
            onChange={handleUpload}
            className="text-sm file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary-light"
          />
        </label>
        {uploadLoading && <span className="text-gray-500 text-sm">Uploading…</span>}
      </p>
      {docsLoading ? (
        <p className="text-gray-500 text-sm">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-500 text-sm">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="text-sm">
              <a
                href={`/api/documents/${doc.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-light font-medium"
              >
                {doc.fileName}
              </a>
              <span className="text-gray-500 ml-1">
                ({doc.docType}
                {doc.fileSize != null ? `, ${(doc.fileSize / 1024).toFixed(1)} KB` : ""},{" "}
                {doc.createdAt})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
