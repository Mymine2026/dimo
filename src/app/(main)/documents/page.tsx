"use client";

import { FileText, Upload } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-white leading-tight">Documenti</h1>
          <p className="text-xs" style={{ color: "#6b7280" }}>Archivio veicoli</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#1e1f23", color: "#c4c7c8" }}
        >
          <Upload className="w-4 h-4" />
          Carica documento
        </button>
      </div>

      <div
        className="flex flex-col items-center justify-center py-20 rounded-2xl"
        style={{ background: "#1e1f23" }}
      >
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: "#292a2e" }}
        >
          <FileText className="w-6 h-6" style={{ color: "#555869" }} />
        </div>
        <p className="text-sm font-semibold text-white mb-1">Nessun documento</p>
        <p className="text-xs" style={{ color: "#6b7280" }}>
          Carica il primo documento per iniziare
        </p>
      </div>
    </div>
  );
}
