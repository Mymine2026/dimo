"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TelemetrySignal, LatestStatus } from "@/types/dimo";
import { SignalChart } from "@/components/SpeedChart";
import { VehicleMap } from "@/components/VehicleMap";
import { formatSpeed, formatPercent } from "@/lib/utils";
import {
  Loader2, AlertCircle, ArrowLeft, RefreshCw, Plug,
  Zap, Gauge, Droplets, Thermometer, Route,
} from "lucide-react";
import Link from "next/link";

const DIMO_CONFIG_ID = process.env.NEXT_PUBLIC_DIMO_CONFIG_ID ?? "";
function dimoConnectUrl() {
  return `https://login.dimo.org?configurationId=${DIMO_CONFIG_ID}`;
}

type Range = "24h" | "7d" | "30d" | "90d";
const RANGES: { label: string; value: Range; hours: number }[] = [
  { label: "24h", value: "24h", hours: 24 },
  { label: "7d",  value: "7d",  hours: 168 },
  { label: "30d", value: "30d", hours: 720 },
  { label: "90d", value: "90d", hours: 2160 },
];

// ─── metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
      <p className="text-[11px] mb-1.5" style={{ color: "#6b7280" }}>{label}</p>
      <p className="text-[22px] font-bold leading-none text-white">{value}</p>
    </div>
  );
}

// ─── chart panel ─────────────────────────────────────────────────────────────

function ChartPanel({
  icon: Icon,
  iconColor,
  title,
  children,
}: {
  icon?: React.ElementType;
  iconColor?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }} className="mb-3">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4" style={{ color: iconColor ?? "#9ca3af" }} />}
        <h3 className="text-xs font-semibold" style={{ color: "#c4c7c8" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function VehicleDetailPage() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [signals,        setSignals]        = useState<TelemetrySignal[]>([]);
  const [latest,         setLatest]         = useState<LatestStatus | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [range,          setRange]          = useState<Range>("30d");
  const [neverConnected, setNeverConnected] = useState(false);
  const firstLoad = useRef(true);

  async function loadTelemetry(checkConnected = false) {
    setLoading(true);
    setError(null);
    const hours = RANGES.find((r) => r.value === range)?.hours ?? 720;
    const queryHours = checkConnected ? 2160 : hours;
    const from = new Date(Date.now() - queryHours * 3_600_000).toISOString();
    const to   = new Date().toISOString();
    try {
      const res  = await fetch(`/api/telemetry?tokenId=${tokenId}&hours=${queryHours}&from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch telemetry");
      if (checkConnected) {
        setNeverConnected(data.length === 0);
        if (data.length > 0 && hours !== queryHours) {
          const r2 = await fetch(`/api/telemetry?tokenId=${tokenId}&hours=${hours}`);
          const d2 = await r2.json();
          setSignals(r2.ok ? d2 : data);
        } else {
          setSignals(data);
        }
      } else {
        setSignals(data);
      }
    } catch (e) {
      const msg = String(e);
      setError(msg.length > 200 ? msg.slice(0, 200) + "…" : msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadLatest() {
    try {
      const res  = await fetch(`/api/latest?tokenId=${tokenId}`);
      const data = await res.json();
      if (res.ok && !data.error) setLatest(data);
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    loadTelemetry(true);
    loadLatest();
    firstLoad.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId]);

  useEffect(() => {
    if (firstLoad.current) return;
    loadTelemetry(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const lastSignal = signals.at(-1);
  const speed    = latest?.speed                                             ?? lastSignal?.speed;
  const fuel     = latest?.powertrainFuelSystemRelativeLevel                 ?? lastSignal?.fuelLevel;
  const rpm      = latest?.powertrainCombustionEngineSpeed                   ?? lastSignal?.engineRpm;
  const coolant  = latest?.powertrainCombustionEngineECT                     ?? lastSignal?.engineCoolantTemp;
  const adBlue   = latest?.powertrainCombustionEngineDieselExhaustFluidLevel ?? lastSignal?.adBlue;
  const voltage  = latest?.lowVoltageBatteryCurrentVoltage                   ?? lastSignal?.batteryVoltage;
  const odometer = latest?.powertrainTransmissionTravelledDistance           ?? lastSignal?.odometer;
  const extTemp  = latest?.exteriorAirTemperature                            ?? lastSignal?.exteriorTemp;
  const ignition = latest?.isIgnitionOn                                      ?? lastSignal?.isIgnitionOn;

  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/vehicles">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: "#1e1f23" }}
            >
              <ArrowLeft className="w-4 h-4" style={{ color: "#9ca3af" }} />
            </div>
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-white leading-tight">
              Veicolo #{tokenId}
            </h1>
            <p className="text-xs" style={{ color: "#6b7280" }}>Telemetria</p>
          </div>
        </div>
        <button
          onClick={() => { loadTelemetry(false); loadLatest(); }}
          disabled={loading}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
          style={{ background: "#1e1f23" }}
          aria-label="Aggiorna"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            style={{ color: "#9ca3af" }}
          />
        </button>
      </div>

      {/* ── Range pills ────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 mb-5"
        style={{ background: "#1e1f23", borderRadius: 12 }}
      >
        {RANGES.map((r) => {
          const active = r.value === range;
          return (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors"
              style={{
                background: active ? "#292a2e" : "transparent",
                color: active ? "#ffffff" : "#555869",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-4"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.18)",
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
          <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
        </div>
      )}

      {/* ── Never connected banner ─────────────────────────────────────── */}
      {!loading && neverConnected && DIMO_CONFIG_ID && (
        <div
          className="flex items-center justify-between rounded-2xl p-4 mb-4"
          style={{
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.18)",
          }}
        >
          <div className="flex items-center gap-3">
            <Plug className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fcd34d" }}>
                Veicolo non connesso
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#92400e" }}>
                Autorizza la condivisione dati tramite DIMO Connect
              </p>
            </div>
          </div>
          <a
            href={dimoConnectUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={{ background: "#fbbf24", color: "#000" }}
          >
            Connetti →
          </a>
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────────────── */}
      {loading && signals.length === 0 && (
        <div className="flex items-center gap-3 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#6b7280" }} />
          <span className="text-sm" style={{ color: "#6b7280" }}>Caricamento telemetria…</span>
        </div>
      )}

      {/* ── Metric cards ───────────────────────────────────────────────── */}
      {(!loading || signals.length > 0) && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="Velocità"   value={formatSpeed(speed)} />
            <MetricCard label="Carburante" value={formatPercent(fuel)} />
            <MetricCard label="RPM"        value={rpm != null ? Math.round(rpm).toLocaleString() : "—"} />
            <MetricCard label="Liquido raffreddamento" value={coolant != null ? `${Math.round(coolant)}°C` : "—"} />
            <MetricCard label="AdBlue"     value={adBlue != null ? `${Math.round(adBlue)}%` : "—"} />
            <MetricCard label="Batteria 12V" value={voltage != null ? `${voltage.toFixed(1)}V` : "—"} />
          </div>

          {/* ── Secondary strip ──────────────────────────────────────── */}
          {(odometer != null || extTemp != null || ignition != null || latest?.obdStatusDTCCount != null) && (
            <div
              className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 rounded-2xl mb-4"
              style={{ background: "#1e1f23" }}
            >
              {odometer != null && (
                <div className="flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5" style={{ color: "#555869" }} />
                  <span className="text-xs" style={{ color: "#6b7280" }}>
                    Km{" "}
                    <span className="font-semibold text-white">
                      {Math.round(odometer).toLocaleString()}
                    </span>
                  </span>
                </div>
              )}
              {extTemp != null && (
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5" style={{ color: "#555869" }} />
                  <span className="text-xs" style={{ color: "#6b7280" }}>
                    Temp est.{" "}
                    <span className="font-semibold text-white">{Math.round(extTemp)}°C</span>
                  </span>
                </div>
              )}
              {ignition != null && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" style={{ color: "#555869" }} />
                  <span className="text-xs" style={{ color: "#6b7280" }}>
                    Accensione{" "}
                    <span
                      className="font-semibold"
                      style={{ color: ignition ? "#22c55e" : "#555869" }}
                    >
                      {ignition ? "ON" : "OFF"}
                    </span>
                  </span>
                </div>
              )}
              {latest?.obdStatusDTCCount != null && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" style={{ color: "#555869" }} />
                  <span className="text-xs" style={{ color: "#6b7280" }}>
                    DTC{" "}
                    <span
                      className="font-semibold"
                      style={{ color: latest.obdStatusDTCCount > 0 ? "#f87171" : "#22c55e" }}
                    >
                      {latest.obdStatusDTCCount}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Charts ───────────────────────────────────────────────── */}
          {signals.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "#4b5563" }}>
              Nessun dato nel periodo selezionato — prova un intervallo più ampio.
            </p>
          ) : (
            <>
              <ChartPanel icon={Gauge} iconColor="#3b82f6" title="Velocità (km/h)">
                <SignalChart signals={signals} field="speed" label="Speed" color="#3b82f6" unit="km/h" />
              </ChartPanel>
              <ChartPanel icon={Droplets} iconColor="#f59e0b" title="Livello carburante (%)">
                <SignalChart signals={signals} field="fuelLevel" label="Fuel" color="#f59e0b" unit="%" />
              </ChartPanel>
              <ChartPanel title="Giri motore (RPM)">
                <SignalChart signals={signals} field="engineRpm" label="RPM" color="#8b5cf6" unit="rpm" />
              </ChartPanel>
              <ChartPanel title="Liquido raffreddamento (°C)">
                <SignalChart signals={signals} field="engineCoolantTemp" label="Coolant" color="#ef4444" unit="°C" />
              </ChartPanel>
            </>
          )}

          {/* ── GPS Map ──────────────────────────────────────────────── */}
          <ChartPanel title="Tracciato GPS">
            <VehicleMap signals={signals} />
          </ChartPanel>
        </>
      )}
    </div>
  );
}
