"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

type Client = {
  id: string;
  agencyId: string;
  fullName: string;
  phone: string | null;
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

type Document = {
  id: string;
  fileName: string;
  docType: string;
  fileSize: number | null;
  createdAt: string;
};

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [client, setClient] = useState<Client | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.status === 401) {
        router.push(`/login?from=/clients/${id}`);
        return;
      }
      if (res.status === 404 || !res.ok) {
        setError("Client not found.");
        setClient(null);
        return;
      }
      const data = (await res.json()) as Client;
      setClient(data);
      if (data.householdId) {
        const hRes = await fetch("/api/households");
        if (hRes.ok) {
          const hData = (await hRes.json()) as { households: Household[] };
          const h = (hData.households ?? []).find((x) => x.id === data.householdId);
          setHouseholdName(h?.name ?? null);
        }
      } else {
        setHouseholdName(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?client_id=${encodeURIComponent(id)}`);
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
    fetchClient();
  }, [fetchClient]);

  useEffect(() => {
    if (client) fetchDocuments();
  }, [client, fetchDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadError(null);
    setUploadLoading(true);
    try {
      const uploadUrlRes = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          docType: "client_document",
          fileName: file.name
        })
      });
      if (uploadUrlRes.status === 401) {
        router.push(`/login?from=/clients/${id}`);
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
      const uploadRes = await fetch(uploadUrl.startsWith("http") ? uploadUrl : `/api/documents/upload`, {
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
          docType: "client_document",
          clientId: id
        })
      });
      if (createRes.status === 401) {
        router.push(`/login?from=/clients/${id}`);
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

  if (loading && !client) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
        <p><Link href="/">Home</Link> · <Link href="/clients">Clients</Link></p>
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error ?? "Client not found."}
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <p><Link href="/">Home</Link> · <Link href="/clients">Clients</Link></p>
      <h1>{client.fullName}</h1>
      <p>
        <Link href={`/clients/${id}/edit`}>Edit</Link>
      </p>

      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 1.5rem" }}>
        <dt style={{ fontWeight: 600 }}>Phone</dt>
        <dd>{client.phone ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Email</dt>
        <dd>{client.email ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Address</dt>
        <dd>{client.address ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Household</dt>
        <dd>{householdName ?? (client.householdId ? client.householdId : "—")}</dd>
        <dt style={{ fontWeight: 600 }}>Notes</dt>
        <dd>{client.notes ?? "—"}</dd>
        <dt style={{ fontWeight: 600 }}>Created</dt>
        <dd>{client.createdAt}</dd>
        <dt style={{ fontWeight: 600 }}>Updated</dt>
        <dd>{client.updatedAt}</dd>
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
