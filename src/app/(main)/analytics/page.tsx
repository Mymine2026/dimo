"use client";

import { BarChart2 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div
      className="flex flex-col items-center justify-center px-6"
      style={{ minHeight: "calc(100vh - 96px)" }}
    >
      <div
        className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ background: "#1e1f23" }}
      >
        <BarChart2 className="w-7 h-7" style={{ color: "#555869" }} />
      </div>
      <h1 className="text-[22px] font-bold text-white mb-2">Analytics</h1>
      <p className="text-sm text-center" style={{ color: "#6b7280" }}>
        Funzionalità in arrivo
      </p>
    </div>
  );
}
