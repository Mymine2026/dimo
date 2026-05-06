"use client";

import { FileText, Upload } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>

      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="font-bold text-white" style={{ fontSize: 16, lineHeight: 1 }}>MyMine</p>
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-white leading-none" style={{ fontSize: 28 }}>Documenti</h1>
          <p style={{ fontSize: 13, color: "#8e9192", marginTop: 4 }}>Archivio veicoli</p>
        </div>
        <button
          className="flex items-center gap-2 font-semibold"
          style={{
            background: "#292a2e",
            color: "#8e9192",
            fontSize: 13,
            padding: "8px 14px",
            borderRadius: 12,
          }}
        >
          <Upload className="w-4 h-4" />
          Carica
        </button>
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center py-20 rounded-2xl"
        style={{ background: "#1e1f23" }}
      >
        <div
          className="flex items-center justify-center mb-4"
          style={{ width: 56, height: 56, background: "#292a2e", borderRadius: 16 }}
        >
          <FileText className="w-6 h-6" style={{ color: "#8e9192" }} />
        </div>
        <p className="font-semibold text-white mb-1" style={{ fontSize: 15 }}>Nessun documento</p>
        <p style={{ fontSize: 13, color: "#8e9192" }}>Carica il primo documento per iniziare</p>
      </div>
    </div>
  );
}
