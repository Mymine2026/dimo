"use client";

import Link from "next/link";
import { Car } from "lucide-react";
import { Vehicle } from "@/types/dimo";

type VehicleStatus = "ACTIVE" | "IN SERVICE" | "ERROR";

const STATUS: Record<VehicleStatus, { bg: string; color: string }> = {
  ACTIVE:       { bg: "rgba(34,197,94,0.15)",   color: "#22c55e" },
  "IN SERVICE": { bg: "rgba(196,199,200,0.12)", color: "#c4c7c8" },
  ERROR:        { bg: "rgba(239,68,68,0.13)",   color: "#f87171" },
};

function computeHealth(v: Vehicle): number {
  let score = 20;
  if (v.aftermarketDevice) score += 50;
  if (v.syntheticDevice) score += 30;
  return score;
}

function computeStatus(v: Vehicle): VehicleStatus {
  if (v.aftermarketDevice) return "ACTIVE";
  if (v.syntheticDevice) return "IN SERVICE";
  return "ERROR";
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const { tokenId, definition } = vehicle;
  const status = computeStatus(vehicle);
  const health = computeHealth(vehicle);
  const s = STATUS[status];

  return (
    <Link href={`/vehicles/${tokenId}`} className="block">
      <div
        className="flex items-center gap-3 active:scale-[0.99] transition-transform"
        style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}
      >
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: "#292a2e" }}
        >
          <Car className="w-5 h-5" style={{ color: "#9ca3af" }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-snug truncate">
            {definition.make} {definition.model}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: "#c4c7c8" }}>
            {definition.year} · #{tokenId}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className="text-[28px] font-bold leading-none text-white">
            {health}
          </span>
          <span
            className="text-[9px] font-bold px-2 py-[3px] rounded-full tracking-widest uppercase"
            style={{ background: s.bg, color: s.color }}
          >
            {status}
          </span>
        </div>
      </div>
    </Link>
  );
}
