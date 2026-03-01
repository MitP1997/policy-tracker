"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

const POLICY_STATUSES = ["active", "renewal_in_progress", "renewed", "lost", "expired"] as const;

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
          fileName: file.name
        })
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
      const uploadRes = await fetch(uploadUrl.startsWith("http") ? uploadUrl : "/api/documents/upload", {
        method: "POST",
        body: form
      });
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
          clientId: policy.clientId
        })
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
        body: JSON.stringify({ status: newStatus })
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
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !policy) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link> · <Link href="/policies">Policies</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error ?? "Policy not found."}
        </p>
      </main>
    );
  }

  const premiumRupees = policy.premiumPaise != null ? (policy.premiumPaise / 100).toFixed(2) : null;

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link> · <Link href="/policies">Policies</Link></p>
      <h1>Policy</h1>
      <p>
        <Link href={`/policies/${id}/edit`}>Edit</Link>
      </p>

      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 1.5rem" }}>
        <dt style={{ fontWeight: 600 }}>Client</dt>
        <dd>
          <Link href={`/clients/${policy.clientId}`}>
            {policy.clientFullName ?? policy.clientId}
          </Link>
        </dd>
        <dt style={{ fontWeight: 600 }}>Insurance type</dt>
        <dd>{policy.insuranceType}</dd>
        <dt style={{ fontWeight: 600 }}>Insurer</dt>
        <dd>{policy.insurerName}</dd>
        <dt style={{ fontWeight: 600 }}>Policy number</dt>
        <dd>{policy.policyNumber ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Start date</dt>
        <dd>{policy.startDate ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>End date</dt>
        <dd>{policy.endDate}</dd>
        <dt style={{ fontWeight: 600 }}>Premium</dt>
        <dd>{premiumRupees != null ? `₹ ${premiumRupees}` : "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Status</dt>
        <dd>
          <select
            value={statusValue}
            onChange={handleStatusChange}
            disabled={statusLoading}
            style={{ padding: "0.25rem" }}
          >
            {POLICY_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </dd>
        <dt style={{ fontWeight: 600 }}>Assigned to</dt>
        <dd>{policy.assignedTo ? (userNames[policy.assignedTo] ?? policy.assignedTo) : "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Notes</dt>
        <dd>{policy.notes ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Status updated</dt>
        <dd>{policy.statusUpdatedAt ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Created</dt>
        <dd>{policy.createdAt}</dd>
        <dt style={{ fontWeight: 600 }}>Updated</dt>
        <dd>{policy.updatedAt}</dd>
      </dl>

      <h2 style={{ marginTop: "2rem" }}>Documents</h2>
      {uploadError && (
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>{uploadError}</p>
      )}
      <p>
        <label>
          Upload document:{" "}
          <input
            type="file"
            disabled={uploadLoading}
            onChange={handleUpload}
            style={{ marginRight: "0.5rem" }}
          />
        </label>
        {uploadLoading && " Uploading…"}
      </p>
      {docsLoading ? (
        <p>Loading documents…</p>
      ) : documents.length === 0 ? (
        <p>No documents yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {documents.map((doc) => (
            <li key={doc.id} style={{ marginBottom: "0.5rem" }}>
              <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                {doc.fileName}
              </a>
              {" "}
              ({doc.docType}
              {doc.fileSize != null ? `, ${(doc.fileSize / 1024).toFixed(1)} KB` : ""}
              , {doc.createdAt})
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
