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
          fileName: file.name,
        }),
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
          docType: "client_document",
          clientId: id,
        }),
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
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Client</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div>
        <p className="mb-2">
          <Link href="/clients" className="text-primary hover:text-primary-light">
            Clients
          </Link>
        </p>
        <p role="alert" className="text-red-600">{error ?? "Client not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        <Link href="/clients" className="text-primary hover:text-primary-light">
          Clients
        </Link>
      </p>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{client.fullName}</h1>
      <p className="mb-6">
        <Link
          href={`/clients/${id}/edit`}
          className="text-primary hover:text-primary-light font-medium"
        >
          Edit
        </Link>
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="font-medium text-gray-700">Phone</dt>
        <dd className="text-gray-900">{client.phone ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Email</dt>
        <dd className="text-gray-900">{client.email ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Address</dt>
        <dd className="text-gray-900">{client.address ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Household</dt>
        <dd className="text-gray-900">
          {householdName ?? (client.householdId ? client.householdId : "—")}
        </dd>
        <dt className="font-medium text-gray-700">Notes</dt>
        <dd className="text-gray-900">{client.notes ?? "—"}</dd>
        <dt className="font-medium text-gray-700">Created</dt>
        <dd className="text-gray-900">{client.createdAt}</dd>
        <dt className="font-medium text-gray-700">Updated</dt>
        <dd className="text-gray-900">{client.updatedAt}</dd>
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
