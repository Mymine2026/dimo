"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Vehicle } from "@/types/dimo";
import { Loader2, AlertCircle, Search, Truck, Wifi, Cpu, AlertTriangle, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import type { FleetPosition } from "@/components/FleetMap";
const FleetMap = dynamic(
  () => import("@/components/FleetMap").then((m) => ({ default: m.FleetMap })),
  { ssr: false, loading: () => <div className="rounded-xl animate-pulse" style={{ background: "#1e1f23", height: 260 }} /> }
);

type VehicleStatus = "ACTIVE" | "IN SERVICE" | "NO SIGNAL";

interface VehicleAlerts {
  adBlue: number | null;
  dtcCount: number | null;
  position?: { latitude: number; longitude: number; timestamp: string } | null;
}

function computeHealth(v: Vehicle): number {
  let score = 20;
  if (v.aftermarketDevice) score += 50;
  if (v.syntheticDevice) score += 30;
  return score;
}

function computeStatus(v: Vehicle): VehicleStatus {
  if (v.aftermarketDevice) return "ACTIVE";
  if (v.syntheticDevice) return "IN SERVICE";
  return "NO SIGNAL";
}

const STATUS_CONFIG: Record<VehicleStatus, { dot: string; badge: string; text: string }> = {
  "ACTIVE":     { dot: "#4ade80", badge: "rgba(74,222,128,0.12)",  text: "#4ade80" },
  "IN SERVICE": { dot: "#60a5fa", badge: "rgba(96,165,250,0.12)",  text: "#60a5fa" },
  "NO SIGNAL":  { dot: "#6b7280", badge: "rgba(107,114,128,0.12)", text: "#6b7280" },
};

function healthColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 50) return "#f59e0b";
  return "#f87171";
}

// ─── stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label, value, color,
}: { label: string; value: number | string; color?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl py-3"
      style={{ background: "#1e1f23", flex: 1 }}
    >
      <span className="font-bold leading-none" style={{ fontSize: 22, color: color ?? "#ffffff" }}>
        {value}
      </span>
      <span
        className="font-semibold tracking-wider uppercase mt-1"
        style={{ fontSize: 9, color: "#8e9192" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── vehicle card ─────────────────────────────────────────────────────────────

function VehicleCard({ vehicle, alerts }: { vehicle: Vehicle; alerts?: VehicleAlerts }) {
  const status = computeStatus(vehicle);
  const health = computeHealth(vehicle);
  const cfg    = STATUS_CONFIG[status];
  const { make, model, year } = vehicle.definition;
  const hasOBD       = !!vehicle.aftermarketDevice;
  const hasSynthetic = !!vehicle.syntheticDevice;

  return (
    <Link href={`/vehicles/${vehicle.tokenId}`} className="block" style={{ marginBottom: 10 }}>
      <div
        className="flex items-center gap-3 active:scale-[0.99] transition-transform"
        style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}
      >
        {/* Icon box */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 52, height: 52, background: "#292a2e", borderRadius: 14 }}
        >
          <Truck className="w-6 h-6" style={{ color: "#9ca3af" }} />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white leading-snug truncate" style={{ fontSize: 16 }}>
            {make} {model}
          </p>
          <p className="truncate" style={{ color: "#8e9192", fontSize: 12, marginTop: 2 }}>
            {year} · #{vehicle.tokenId}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            {hasOBD && (
              <span
                className="flex items-center gap-1 font-semibold"
                style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 6,
                  background: "rgba(96,165,250,0.12)", color: "#60a5fa",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}
              >
                <Wifi className="w-2.5 h-2.5" /> OBD
              </span>
            )}
            {hasSynthetic && (
              <span
                className="flex items-center gap-1 font-semibold"
                style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 6,
                  background: "rgba(139,92,246,0.12)", color: "#a78bfa",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}
              >
                <Cpu className="w-2.5 h-2.5" /> SYNTHETIC
              </span>
            )}
            {alerts?.adBlue != null && alerts.adBlue < 25 && (
              <span
                className="flex items-center gap-1 font-semibold"
                style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 6,
                  background: alerts.adBlue < 10 ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                  color: alerts.adBlue < 10 ? "#f87171" : "#fcd34d",
                  letterSpacing: "0.05em",
                }}
              >
                <AlertTriangle className="w-2.5 h-2.5" /> AdBlue {Math.round(alerts.adBlue)}%
              </span>
            )}
            {alerts?.dtcCount != null && alerts.dtcCount > 0 && (
              <span
                className="flex items-center gap-1 font-semibold"
                style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 6,
                  background: "rgba(239,68,68,0.15)", color: "#f87171",
                  letterSpacing: "0.05em",
                }}
              >
                <AlertTriangle className="w-2.5 h-2.5" /> {alerts.dtcCount} DTC
              </span>
            )}
          </div>
        </div>

        {/* Right: health score + status */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className="font-bold leading-none" style={{ fontSize: 32, color: healthColor(health) }}>
            {health}
          </span>
          <span className="font-semibold tracking-widest uppercase" style={{ fontSize: 9, color: "#8e9192" }}>
            Health
          </span>
          <span
            className="flex items-center gap-1 font-bold"
            style={{
              fontSize: 9, padding: "3px 8px", borderRadius: 999,
              background: cfg.badge, color: cfg.text,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
            {status}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vehicles,   setVehicles]   = useState<Vehicle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [latestMap,  setLatestMap]  = useState<Map<number, VehicleAlerts>>(new Map());
  const alertsFetched = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/vehicles")
      .then(async (res) => {
        const text = await res.text();
        if (!text) throw new Error("Risposta vuota dal server");
        const data = JSON.parse(text) as unknown;
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Errore caricamento");
        return data as Vehicle[];
      })
      .then((vs) => {
        setVehicles(vs);
        // Fetch alerts + positions for all vehicles in parallel (fire-and-forget)
        if (!alertsFetched.current) {
          alertsFetched.current = true;
          Promise.all(
            vs.map(v =>
              fetch(`/api/latest?tokenId=${v.tokenId}`)
                .then(async r => {
                  const text = await r.text();
                  if (!text) return null;
                  const d = JSON.parse(text) as Record<string, unknown>;
                  if (!r.ok || d.error) return null;
                  return {
                    tokenId: v.tokenId,
                    adBlue: (d.powertrainCombustionEngineDieselExhaustFluidLevel as number | null) ?? null,
                    dtcCount: (d.obdStatusDTCCount as number | null) ?? null,
                    position: (d.currentLocationCoordinates as { latitude: number; longitude: number; timestamp: string } | null) ?? null,
                  };
                })
                .catch(() => null)
            )
          ).then(results => {
            const m = new Map<number, VehicleAlerts>();
            for (const r of results) {
              if (r) m.set(r.tokenId, { adBlue: r.adBlue, dtcCount: r.dtcCount, position: r.position });
            }
            setLatestMap(m);
          });
        }
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading") return null;
  if (status === "unauthenticated") { router.push("/login"); return null; }

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

  const activeCount    = vehicles.filter((v) => computeStatus(v) === "ACTIVE").length;
  const serviceCount   = vehicles.filter((v) => computeStatus(v) === "IN SERVICE").length;
  const noSignalCount  = vehicles.filter((v) => computeStatus(v) === "NO SIGNAL").length;

  const fleetPositions: FleetPosition[] = vehicles
    .filter((v) => latestMap.get(v.tokenId)?.position != null)
    .map((v) => {
      const pos = latestMap.get(v.tokenId)!.position!;
      return {
        tokenId: v.tokenId,
        label: `${v.definition.make} ${v.definition.model}`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        timestamp: pos.timestamp,
      };
    });

  return (
    <div className="px-4 pt-6 pb-8" style={{ minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <img src="/conexo-logo.png" alt="Conexo Technologies" style={{ height: 32 }} />
          <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
        </div>
        <div
          className="flex items-center justify-center rounded-full font-bold text-white"
          style={{ width: 36, height: 36, background: "#1e1f23", fontSize: 14 }}
        >
          {initial}
        </div>
      </div>

      {/* ── Title ── */}
      <h1 className="font-bold text-white mb-4" style={{ fontSize: 28 }}>Flotta</h1>

      {/* ── Stats pills ── */}
      {!loading && !error && (
        <div className="flex gap-2 mb-5">
          <StatPill label="Active"     value={activeCount}   color="#4ade80" />
          <StatPill label="In Service" value={serviceCount}  color="#60a5fa" />
          <StatPill label="No Signal"  value={noSignalCount} color="#6b7280" />
          <StatPill label="Total"      value={vehicles.length} />
        </div>
      )}

      {/* ── Search ── */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 mb-5"
        style={{ background: "#1e1f23", borderRadius: 12 }}
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: "#8e9192" }} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca marca, modello, anno..."
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#8e9192]"
        />
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8e9192" }} />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-4"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
          <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
        </div>
      )}

      {/* ── Vehicle list ── */}
      {!loading && !error && (
        <>
          {filtered.map((v) => <VehicleCard key={v.tokenId} vehicle={v} alerts={latestMap.get(v.tokenId)} />)}
          {filtered.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl"
              style={{ background: "#1e1f23" }}
            >
              <Truck className="w-8 h-8 mb-3" style={{ color: "#3a3b3f" }} />
              <p className="font-semibold text-white mb-1" style={{ fontSize: 15 }}>
                {search ? "Nessun risultato" : "Nessun veicolo"}
              </p>
              <p style={{ fontSize: 13, color: "#8e9192" }}>
                {search ? `per "${search}"` : "Nessun veicolo nella flotta"}
              </p>
            </div>
          )}

          {/* ── Posizioni Fleet ── */}
          {fleetPositions.length > 0 && (
            <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16, marginTop: 16 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <div
                  className="flex items-center justify-center"
                  style={{ width: 24, height: 24, background: "#22c55e22", borderRadius: 6 }}
                >
                  <MapPin className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                </div>
                <h3 className="text-sm font-semibold text-white">Posizioni Fleet</h3>
                <span style={{ fontSize: 11, color: "#8e9192", marginLeft: "auto" }}>
                  {fleetPositions.length} veicol{fleetPositions.length === 1 ? "o" : "i"}
                </span>
              </div>
              <div style={{ borderRadius: 12, overflow: "hidden" }}>
                <FleetMap positions={fleetPositions} height="260px" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
