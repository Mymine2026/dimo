"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Email o password non corretti.");
    } else {
      router.push("/vehicles");
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: "#121317" }}
    >
      {/* ── Brand ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center mb-10">
        {/* Logo mark */}
        <div
          className="flex items-center justify-center mb-4"
          style={{
            width: 72, height: 72,
            background: "#ffffff",
            borderRadius: 22,
            boxShadow: "0 0 48px rgba(255,255,255,0.12)",
          }}
        >
          {/* Car silhouette as SVG for a cleaner look */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 4v4a2 2 0 0 1-2 2h-2" />
            <circle cx="7.5" cy="17.5" r="2.5" />
            <circle cx="17.5" cy="17.5" r="2.5" />
          </svg>
        </div>
        <h1 className="font-bold text-white" style={{ fontSize: 28, letterSpacing: -0.5 }}>MyMine</h1>
        <p style={{ fontSize: 13, color: "#8e9192", marginTop: 4 }}>Vehicle Intelligence Platform</p>
      </div>

      {/* ── Form card ────────────────────────────────────────────── */}
      <div
        className="w-full"
        style={{ maxWidth: 380, background: "#1e1f23", borderRadius: 24, padding: 24 }}
      >
        <h2 className="font-bold text-white mb-1" style={{ fontSize: 20 }}>Accedi</h2>
        <p style={{ fontSize: 13, color: "#8e9192", marginBottom: 24 }}>
          Inserisci le tue credenziali per continuare.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="font-semibold uppercase tracking-widest"
              style={{ fontSize: 10, color: "#8e9192" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@azienda.com"
              className="w-full text-white text-sm outline-none transition-colors"
              style={{
                background: "#292a2e",
                borderRadius: 12,
                padding: "12px 14px",
                caretColor: "#ffffff",
              }}
            />
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-semibold uppercase tracking-widest"
              style={{ fontSize: 10, color: "#8e9192" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-white text-sm outline-none"
              style={{
                background: "#292a2e",
                borderRadius: 12,
                padding: "12px 14px",
                caretColor: "#ffffff",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
              <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 font-bold transition-opacity disabled:opacity-50"
            style={{
              marginTop: 4,
              background: "#ffffff",
              color: "#000000",
              borderRadius: 14,
              padding: "14px",
              fontSize: 15,
            }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: "#3a3b3f", marginTop: 32 }}>
        © {new Date().getFullYear()} MyMine · Powered by DIMO
      </p>
    </div>
  );
}
