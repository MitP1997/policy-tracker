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
        body: JSON.stringify({ whatsapp_number: whatsappNumber }),
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: whatsappNumber, code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-card">
        <h1 className="text-xl font-semibold text-primary mb-1">Graazo</h1>
        <p className="text-gray-600 text-sm mb-6">
          Enter your WhatsApp number to receive a one-time code.
        </p>

        {error && (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg"
          >
            {error}
          </p>
        )}

        {step === "number" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              WhatsApp number (E.164)
            </label>
            <input
              id="phone"
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+919876543210"
              required
              autoComplete="tel"
              className="block w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-gray-600">
              Code sent to {whatsappNumber}. Check server logs if testing locally.
            </p>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Verification code
            </label>
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
              className="block w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                type="submit"
                disabled={loading}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => setStep("number")}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Change number
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-md mx-auto px-4 py-8">
          <p className="text-gray-500">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
