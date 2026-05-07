"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

type Tab = "fleet" | "driver";

export default function LoginPage() {
  const router = useRouter();
  const [tab,      setTab]      = useState<Tab>("fleet");
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
      className="min-h-screen flex flex-col px-5 pt-8 pb-10"
      style={{ background: "#121317" }}
    >
      {/* ── Logo top-left ── */}
      <div className="flex items-center gap-2.5 mb-12">
        <div
          className="flex items-center justify-center"
          style={{ width: 40, height: 40, background: "#ffffff", borderRadius: 12 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 4v4a2 2 0 0 1-2 2h-2" />
            <circle cx="7.5" cy="17.5" r="2.5" />
            <circle cx="17.5" cy="17.5" r="2.5" />
          </svg>
        </div>
        <span className="font-bold text-white" style={{ fontSize: 18 }}>MyMine</span>
      </div>

      {/* ── Heading ── */}
      <div className="mb-8">
        <h1 className="font-bold text-white mb-2" style={{ fontSize: 32, letterSpacing: -0.5 }}>
          Welcome Back
        </h1>
        <p style={{ fontSize: 14, color: "#8e9192", lineHeight: 1.5 }}>
          Sign in to manage your<br />precision fleet operations.
        </p>
      </div>

      {/* ── Role tabs (visual only) ── */}
      <div
        className="flex p-1 mb-7 rounded-2xl"
        style={{ background: "#1e1f23" }}
      >
        {(["fleet", "driver"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl font-semibold transition-all"
            style={{
              fontSize: 13,
              background: tab === t ? "#ffffff" : "transparent",
              color:      tab === t ? "#000000" : "#8e9192",
            }}
          >
            {t === "fleet" ? "Fleet Manager" : "Driver"}
          </button>
        ))}
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            className="w-full text-white text-sm outline-none"
            style={{ background: "#1e1f23", borderRadius: 14, padding: "14px 16px", caretColor: "#ffffff" }}
          />
        </div>

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
            style={{ background: "#1e1f23", borderRadius: 14, padding: "14px 16px", caretColor: "#ffffff" }}
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
            <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 font-bold transition-opacity disabled:opacity-50"
          style={{ marginTop: 8, background: "#ffffff", color: "#000", borderRadius: 16, padding: "16px", fontSize: 15 }}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Accesso in corso…</>
            : <>Sign In <ArrowRight className="w-4 h-4" /></>
          }
        </button>
      </form>

      <p style={{ fontSize: 12, color: "#3a3b3f", marginTop: "auto", paddingTop: 40, textAlign: "center" }}>
        © {new Date().getFullYear()} MyMine · Powered by DIMO
      </p>
    </div>
  );
}
