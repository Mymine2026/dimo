"use client";

import { useSession, signOut } from "next-auth/react";
import { Shield, LogOut, ChevronRight, Settings2 } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { data: session } = useSession();

  const email   = session?.user?.email ?? "—";
  const role    = (session?.user as { role?: string } | undefined)?.role ?? "—";
  const initial = email[0]?.toUpperCase() ?? "?";

  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>

      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="font-bold text-white" style={{ fontSize: 16, lineHeight: 1 }}>MyMine</p>
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>

      {/* ── Title ────────────────────────────────────────────────── */}
      <h1 className="font-bold text-white mb-5" style={{ fontSize: 28 }}>Profilo</h1>

      {/* ── Avatar card ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 mb-3"
        style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}
      >
        {/* Circle avatar with initial */}
        <div
          className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
          style={{ width: 52, height: 52, background: "#292a2e", fontSize: 20 }}
        >
          {initial}
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-white truncate" style={{ fontSize: 15 }}>{email}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Shield className="w-3 h-3 shrink-0" style={{ color: "#8e9192" }} />
            <span
              className="capitalize"
              style={{ fontSize: 12, color: "#8e9192" }}
            >
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* ── Admin link (super_admin only) ────────────────────────── */}
      {role === "super_admin" && (
        <Link
          href="/admin"
          className="flex items-center gap-3 w-full mb-3 transition-opacity active:opacity-70"
          style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: 16, padding: 16 }}
        >
          <Settings2 className="w-4 h-4 shrink-0" style={{ color: "#a78bfa" }} />
          <span className="font-semibold flex-1" style={{ fontSize: 14, color: "#a78bfa" }}>Pannello Admin</span>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#a78bfa" }} />
        </Link>
      )}

      {/* ── Logout button ────────────────────────────────────────── */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 w-full transition-opacity active:opacity-70"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.18)",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <LogOut className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
        <span className="font-semibold" style={{ fontSize: 14, color: "#f87171" }}>Esci</span>
      </button>
    </div>
  );
}
