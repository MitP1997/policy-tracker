"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Allow only same-origin relative paths for redirect; prevents open redirect. */
function safeRedirectPath(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  try {
    new URL(path, "http://localhost");
    return path;
  } catch {
    return "/";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeRedirectPath(searchParams.get("from"));

  const [step, setStep] = useState<"number" | "code">("number");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: whatsappNumber })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to send OTP");
        return;
      }
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: whatsappNumber, code })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      router.push(from);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Login</h1>
      <p>Enter your WhatsApp number to receive a one-time code.</p>

      {error && (
        <p role="alert" style={{ color: "var(--color-error, #c00)" }}>
          {error}
        </p>
      )}

      {step === "number" && (
        <form onSubmit={handleRequestOtp}>
          <label htmlFor="phone">WhatsApp number (E.164)</label>
          <input
            id="phone"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+919876543210"
            required
            autoComplete="tel"
            style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send OTP"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerifyOtp}>
          <p>Code sent to {whatsappNumber}. Check server logs if testing locally.</p>
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            required
            autoComplete="one-time-code"
            style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => setStep("number")}
            style={{ marginLeft: "0.5rem" }}
          >
            Change number
          </button>
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 400, margin: "2rem auto", padding: "0 1rem" }}><p>Loading…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
