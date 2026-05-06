"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Vehicle } from "@/types/dimo";
import { Loader2, AlertCircle, Search, Car, LogOut } from "lucide-react";

const MapSection = dynamic(() => import("@/components/VehicleMap"), { ssr: false });

type VehicleStatus = "ACTIVE" | "IN SERVICE" | "ERROR";

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

const STATUS: Record<VehicleStatus, { bg: string; color: string }> = {
  ACTIVE:       { bg: "rgba(34,197,94,0.15)",   color: "#22c55e" },
  "IN SERVICE": { bg: "rgba(196,199,200,0.12)", color: "#c4c7c8" },
  ERROR:        { bg: "rgba(239,68,68,0.13)",   color: "#f87171" },
};

function StatusBadge({ status }: { status: VehicleStatus }) {
  const s = STATUS[status];
  return (
    <span
      className="shrink-0 text-[9px] font-bold px-2 py-[3px] rounded-full tracking-widest uppercase"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const status = computeStatus(vehicle);
  const health = computeHealth(vehicle);
  const { make, model, year } = vehicle.definition;

  return (
    <Link href={`/vehicles/${vehicle.tokenId}`} className="block mb-3">
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
            {make} {model}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: "#c4c7c8" }}>
            {year} · #{vehicle.tokenId}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span
            className="text-[28px] font-bold leading-none"
            style={{ color: "#ffffff" }}
          >
            {health}
          </span>
          <StatusBadge status={status} />
        </div>
      </div>
    </Link>
  );
}

export default function VehiclesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/vehicles")
      .then((res) =>
        res.json().then((data: unknown) => ({ ok: res.ok, data }))
      )
      .then(({ ok, data }) => {
        if (!ok)
          throw new Error(
            (data as { error?: string }).error ?? "Errore caricamento veicoli"
          );
        setVehicles(data as Vehicle[]);
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading") return <div style={{color:'white',padding:'20px'}}>Caricamento sessione...</div>;
  if (status === "unauthenticated") { router.push("/login"); return null; }

  const filtered = search
    ? vehicles.filter((v) => {
        const q = search.toLowerCase();
        return (
          v.definition.make.toLowerCase().includes(q) ||
          v.definition.model.toLowerCase().includes(q) ||
          String(v.definition.year).includes(q) ||
          String(v.tokenId).includes(q)
        );
      })
    : vehicles;

  return (
    <div style={{color: 'white', padding: '20px'}}>
      <h1>Test page</h1>
      <p>Session: {session?.user?.email}</p>
    </div>
  );
}
