"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Vehicle } from "@/types/dimo";
import { Loader2, AlertCircle, Search, Truck } from "lucide-react";

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

const STATUS_STYLE: Record<VehicleStatus, { bg: string; color: string }> = {
  ACTIVE:       { bg: "#14532d", color: "#4ade80" },
  "IN SERVICE": { bg: "#374151", color: "#9ca3af" },
  ERROR:        { bg: "#7f1d1d", color: "#f87171" },
};

function StatusBadge({ status }: { status: VehicleStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="text-[9px] font-bold px-2 py-[3px] rounded-full tracking-widest uppercase"
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
    <Link href={`/vehicles/${vehicle.tokenId}`} className="block" style={{ marginBottom: 12 }}>
      <div
        className="flex items-center gap-3 active:scale-[0.99] transition-transform"
        style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}
      >
        {/* Truck icon box */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 48, height: 48, background: "#292a2e", borderRadius: 12 }}
        >
          <Truck className="w-5 h-5" style={{ color: "#9ca3af" }} />
        </div>

        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white leading-snug truncate" style={{ fontSize: 16 }}>
            {make} {model}
          </p>
          <p className="truncate mt-0.5" style={{ color: "#8e9192", fontSize: 13 }}>
            {year} · #{vehicle.tokenId}
          </p>
        </div>

        {/* Health score + label + badge */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="font-bold leading-none text-white" style={{ fontSize: 32 }}>
            {health}
          </span>
          <span
            className="font-semibold tracking-widest uppercase"
            style={{ fontSize: 10, color: "#8e9192" }}
          >
            HEALTH SCORE
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
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState<string | null>(null);
  const [search,   setSearch]     = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/vehicles")
      .then((res) => res.json().then((data: unknown) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error((data as { error?: string }).error ?? "Errore caricamento veicoli");
        setVehicles(data as Vehicle[]);
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading") return null;
  if (status === "unauthenticated") { router.push("/login"); return null; }

  const role    = (session?.user as { role?: string } | undefined)?.role ?? "";
  const initial = session?.user?.email?.[0]?.toUpperCase() ?? "?";

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
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>

      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-bold text-white" style={{ fontSize: 16, lineHeight: 1 }}>MyMine</p>
          <p className="mt-0.5" style={{ fontSize: 11, color: "#8e9192" }}>Vehicle Intelligence</p>
        </div>
        <div
          className="flex items-center justify-center rounded-full font-bold text-white"
          style={{ width: 36, height: 36, background: "#292a2e", fontSize: 14 }}
        >
          {initial}
        </div>
      </div>

      {/* ── Fleet title + role badge + count ─────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-bold text-white leading-none" style={{ fontSize: 28 }}>Fleet</h1>
          {role && (
            <span
              className="font-bold tracking-widest uppercase"
              style={{
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
              }}
            >
              {role}
            </span>
          )}
        </div>
        {!loading && !error && (
          <p className="mt-1.5" style={{ fontSize: 13, color: "#8e9192" }}>
            {vehicles.length} veicol{vehicles.length === 1 ? "o" : "i"} nella flotta
          </p>
        )}
      </div>

      {/* ── Search bar ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 mb-5"
        style={{ background: "#1e1f23", border: "1px solid #444748", borderRadius: 12 }}
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: "#8e9192" }} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca veicoli, targhe..."
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#8e9192]"
          style={{ caretColor: "#818cf8" }}
        />
      </div>

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8e9192" }} />
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-4"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
          <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
        </div>
      )}

      {/* ── Vehicle list ─────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {filtered.map((v) => <VehicleCard key={v.tokenId} vehicle={v} />)}
          {filtered.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: "#4b5563" }}>
              {search ? `Nessun risultato per "${search}"` : "Nessun veicolo nella flotta."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
