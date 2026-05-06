"use client";

import { BarChart2 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>

      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="font-bold text-white" style={{ fontSize: 16, lineHeight: 1 }}>MyMine</p>
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>

      {/* ── Title ────────────────────────────────────────────────── */}
      <h1 className="font-bold text-white mb-6" style={{ fontSize: 28 }}>Analytics</h1>

      {/* ── Empty state ──────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center py-20 rounded-2xl"
        style={{ background: "#1e1f23" }}
      >
        <div
          className="flex items-center justify-center mb-4"
          style={{ width: 56, height: 56, background: "#292a2e", borderRadius: 16 }}
        >
          <BarChart2 className="w-6 h-6" style={{ color: "#8e9192" }} />
        </div>
        <p className="font-semibold text-white mb-1" style={{ fontSize: 15 }}>Analytics</p>
        <p style={{ fontSize: 13, color: "#8e9192" }}>Funzionalità in arrivo</p>
      </div>
    </div>
  );
}
