"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Vehicle } from "@/types/dimo";
import {
  Loader2,
  AlertCircle,
  Search,
  Car,
  LogOut,
  MapPin,
} from "lucide-react";

// ─── types ───────────────────────────────────────────────────────────────────

type VehicleStatus = "ACTIVE" | "IN SERVICE" | "ERROR";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── status config ────────────────────────────────────────────────────────────

const STATUS: Record<VehicleStatus, { bg: string; color: string; dot: string }> = {
  ACTIVE:       { bg: "rgba(34,197,94,0.12)",   color: "#4ade80", dot: "#4ade80" },
  "IN SERVICE": { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", dot: "#fbbf24" },
  ERROR:        { bg: "rgba(248,113,113,0.12)", color: "#f87171", dot: "#f87171" },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VehicleStatus }) {
  const s = STATUS[status];
  return (
    <span
      className="shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "#4ade80" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px]" style={{ color: "#6b7280" }}>
          Health score
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {score}%
        </span>
      </div>
      <div className="h-1 rounded-full" style={{ background: "#2a2c33" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color, transition: "width 0.4s ease" }}
        />
      </div>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const status = computeStatus(vehicle);
  const health = computeHealth(vehicle);
  const dot = STATUS[status].dot;

  return (
    <Link href={`/vehicles/${vehicle.tokenId}`} className="block mb-3">
      <div
        className="rounded-2xl p-4 active:scale-[0.99] transition-transform"
        style={{ background: "#1e1f23", borderRadius: "16px" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: "#2a2c33" }}
              >
                <Car
                  className="w-[18px] h-[18px]"
                  style={{ color: "#9ca3af" }}
                />
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: dot, borderColor: "#1e1f23" }}
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm leading-snug truncate">
                {vehicle.definition.year} {vehicle.definition.make}
              </p>
              <p className="text-xs truncate" style={{ color: "#9ca3af" }}>
                {vehicle.definition.model}
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <HealthBar score={health} />
        <p className="text-[11px] mt-2" style={{ color: "#4b5563" }}>
          Token #{vehicle.tokenId}
        </p>
      </div>
    </Link>
  );
}

function MapSection() {
  return (
    <div
      className="rounded-2xl p-4 mt-2 mb-4"
      style={{ background: "#1e1f23", borderRadius: "16px" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4" style={{ color: "#9ca3af" }} />
        <h3 className="font-semibold text-sm text-white">Posizioni fleet</h3>
      </div>
      <div
        className="h-44 rounded-xl flex flex-col items-center justify-center gap-2"
        style={{ background: "#2a2c33", borderRadius: "12px" }}
      >
        <MapPin className="w-6 h-6" style={{ color: "#374151" }} />
        <p className="text-xs text-center px-8" style={{ color: "#6b7280" }}>
          Apri un veicolo per vedere la posizione GPS in tempo reale
        </p>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const { data: session } = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
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
  }, []);

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
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1
            className="text-[26px] font-bold text-white leading-tight tracking-tight"
          >
            Fleet
          </h1>
          {session?.user?.role && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block tracking-widest uppercase"
              style={{
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
              }}
            >
              {session.user.role}
            </span>
          )}
          {!loading && !error && (
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              {vehicles.length}{" "}
              veicol{vehicles.length === 1 ? "o" : "i"} nella flotta
            </p>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-9 h-9 rounded-xl flex items-center justify-center mt-1 transition-opacity hover:opacity-70"
          style={{ background: "#1e1f23" }}
          aria-label="Logout"
        >
          <LogOut
            className="w-[17px] h-[17px]"
            style={{ color: "#9ca3af" }}
          />
        </button>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl mb-5"
        style={{ background: "#1e1f23", borderRadius: "16px" }}
      >
        <Search
          className="w-4 h-4 shrink-0"
          style={{ color: "#6b7280" }}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca veicolo..."
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#4b5563]"
          style={{ caretColor: "#818cf8" }}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: "#6b7280" }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-4"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.18)",
          }}
        >
          <AlertCircle
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: "#f87171" }}
          />
          <span className="text-sm" style={{ color: "#fca5a5" }}>
            {error}
          </span>
        </div>
      )}

      {/* Vehicle list */}
      {!loading && !error && (
        <>
          {filtered.map((v) => (
            <VehicleCard key={v.tokenId} vehicle={v} />
          ))}
          {filtered.length === 0 && (
            <p
              className="text-sm text-center py-10"
              style={{ color: "#4b5563" }}
            >
              {search
                ? `Nessun risultato per "${search}"`
                : "Nessun veicolo nella flotta."}
            </p>
          )}
          <MapSection />
        </>
      )}
    </div>
  );
}
