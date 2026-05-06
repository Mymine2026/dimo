"use client";

import { useSession, signOut } from "next-auth/react";
import { User, LogOut, Shield } from "lucide-react";

export default function ProfilePage() {
  const { data: session } = useSession();

  const email = session?.user?.email ?? "—";
  const role  = (session?.user as { role?: string } | undefined)?.role ?? "—";

  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>
      <h1 className="text-[20px] font-bold text-white mb-6">Profilo</h1>

      {/* Avatar + info */}
      <div
        className="flex items-center gap-4 p-4 rounded-2xl mb-4"
        style={{ background: "#1e1f23" }}
      >
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0"
          style={{ background: "#292a2e" }}
        >
          <User className="w-6 h-6" style={{ color: "#9ca3af" }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{email}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Shield className="w-3 h-3" style={{ color: "#555869" }} />
            <span className="text-xs capitalize" style={{ color: "#6b7280" }}>
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 w-full p-4 rounded-2xl transition-opacity active:opacity-70"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
      >
        <LogOut className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
        <span className="text-sm font-semibold" style={{ color: "#f87171" }}>Esci</span>
      </button>
    </div>
  );
}
