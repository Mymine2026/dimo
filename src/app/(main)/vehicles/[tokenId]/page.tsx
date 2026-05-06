"use client";

import { Component, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { TelemetrySignal, LatestStatus } from "@/types/dimo";
import { SignalChart } from "@/components/SpeedChart";
import dynamic from "next/dynamic";
const VehicleMap = dynamic(() => import("@/components/VehicleMap").then(m => ({ default: m.VehicleMap })), { ssr: false, loading: () => <div className="h-64 rounded-xl animate-pulse" style={{ background: "#1e1f23" }} /> });
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

// ─── error boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div className="px-4 pt-6">
          <div
            className="rounded-2xl p-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
          >
            <p className="text-sm font-bold mb-2" style={{ color: "#f87171" }}>
              {err.name}: {err.message}
            </p>
            {err.stack && (
              <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap break-all" style={{ color: "#fca5a5", opacity: 0.7 }}>
                {err.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Defensive: handles both flat numbers and {timestamp, value} objects
function extractNum(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  if (typeof raw === "object" && "value" in (raw as object)) {
    const v = (raw as Record<string, unknown>).value;
    return typeof v === "number" && isFinite(v) ? v : null;
  }
  return null;
}

// ─── metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
      <p style={{ fontSize: 11, color: "#8e9192", marginBottom: 6 }}>{label}</p>
      <p className="font-bold leading-none text-white" style={{ fontSize: 22 }}>{value}</p>
      {subtitle && (
        <p style={{ fontSize: 10, color: "#8e9192", marginTop: 6 }}>{subtitle}</p>
      )}
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
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        {Icon && <Icon className="w-4 h-4" style={{ color: iconColor ?? "#8e9192" }} />}
        <h3 className="text-xs font-semibold" style={{ color: "#8e9192" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

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
    const hours      = RANGES.find((r) => r.value === range)?.hours ?? 720;
    const queryHours = checkConnected ? 2160 : hours;
    const from = new Date(Date.now() - queryHours * 3_600_000).toISOString();
    const to   = new Date().toISOString();

    const normalise = (s: TelemetrySignal) => ({
      ...s,
      speed:             typeof s.speed             === "number" ? s.speed             : 0,
      fuelLevel:         typeof s.fuelLevel         === "number" ? s.fuelLevel         : null,
      engineRpm:         typeof s.engineRpm         === "number" ? s.engineRpm         : null,
      engineCoolantTemp: typeof s.engineCoolantTemp === "number" ? s.engineCoolantTemp : null,
    });

    try {
      const res  = await fetch(`/api/telemetry?tokenId=${tokenId}&hours=${queryHours}&from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch telemetry");

      if (checkConnected) {
        setNeverConnected(data.length === 0);
        if (data.length > 0 && hours !== queryHours) {
          const r2 = await fetch(`/api/telemetry?tokenId=${tokenId}&hours=${hours}`);
          const d2 = await r2.json();
          setSignals((r2.ok ? d2 : data).slice(-100).map(normalise));
        } else {
          setSignals(data.slice(-100).map(normalise));
        }
      } else {
        setSignals(data.slice(-100).map(normalise));
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

  const lastSignal  = signals.at(-1);
  const lastUpdated = lastSignal?.timestamp
    ? new Date(lastSignal.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  const speed    = extractNum(latest?.speed)                                             ?? lastSignal?.speed;
  const fuel     = extractNum(latest?.powertrainFuelSystemRelativeLevel)                 ?? lastSignal?.fuelLevel;
  const rpm      = extractNum(latest?.powertrainCombustionEngineSpeed)                   ?? lastSignal?.engineRpm;
  const coolant  = extractNum(latest?.powertrainCombustionEngineECT)                     ?? lastSignal?.engineCoolantTemp;
  const adBlue   = extractNum(latest?.powertrainCombustionEngineDieselExhaustFluidLevel) ?? lastSignal?.adBlue;
  const voltage  = extractNum(latest?.lowVoltageBatteryCurrentVoltage)                   ?? lastSignal?.batteryVoltage;
  const odometer = extractNum(latest?.powertrainTransmissionTravelledDistance)           ?? lastSignal?.odometer;
  const extTemp  = extractNum(latest?.exteriorAirTemperature)                            ?? lastSignal?.exteriorTemp;
  const ignition = extractNum(latest?.isIgnitionOn)                                      ?? lastSignal?.isIgnitionOn;
  const engineOn = ignition == null || Number(ignition) !== 0;

  const speedSignals   = signals.filter(s => s.timestamp && s.speed    !== undefined).map(s => ({ ...s, speed:             Number(s.speed)             || 0 }));
  const fuelSignals    = signals.filter(s => s.timestamp && s.fuelLevel !== undefined).map(s => ({ ...s, fuelLevel:         Number(s.fuelLevel)         || 0 }));
  const rpmSignals     = signals.filter(s => s.timestamp && s.engineRpm !== undefined).map(s => ({ ...s, engineRpm:         Number(s.engineRpm)         || 0 }));
  const coolantSignals = signals.filter(s => s.timestamp && s.engineCoolantTemp !== undefined).map(s => ({ ...s, engineCoolantTemp: Number(s.engineCoolantTemp) || 0 }));

  const locations = signals
    .filter(s => s.location?.latitude != null)
    .map(s => ({ timestamp: s.timestamp, latitude: s.location!.latitude, longitude: s.location!.longitude }));

  return (
    <ErrorBoundary>
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/vehicles">
            <div
              className="flex items-center justify-center"
              style={{ width: 36, height: 36, background: "#292a2e", borderRadius: 10 }}
            >
              <ArrowLeft className="w-4 h-4" style={{ color: "#8e9192" }} />
            </div>
          </Link>
          <div>
            <h1 className="font-bold text-white leading-tight" style={{ fontSize: 18 }}>
              Veicolo #{tokenId}
            </h1>
            <p style={{ fontSize: 11, color: "#8e9192" }}>Telemetria</p>
          </div>
        </div>
        <button
          onClick={() => { loadTelemetry(false); loadLatest(); }}
          disabled={loading}
          className="flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{ width: 36, height: 36, background: "#292a2e", borderRadius: 10 }}
          aria-label="Aggiorna"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            style={{ color: "#8e9192" }}
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
                color:      active ? "#ffffff" : "#8e9192",
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
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
          <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
        </div>
      )}

      {/* ── Never connected banner ─────────────────────────────────────── */}
      {!loading && neverConnected && DIMO_CONFIG_ID && (
        <div
          className="flex items-center justify-between rounded-2xl p-4 mb-4"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)" }}
        >
          <div className="flex items-center gap-3">
            <Plug className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fcd34d" }}>Veicolo non connesso</p>
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

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && signals.length === 0 && (
        <div className="flex items-center gap-3 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} />
          <span className="text-sm" style={{ color: "#8e9192" }}>Caricamento telemetria…</span>
        </div>
      )}

      {/* ── Metric cards ───────────────────────────────────────────────── */}
      {(!loading || signals.length > 0) && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="Velocità"     value={formatSpeed(speed)}  subtitle={lastUpdated} />
            <MetricCard label="Carburante"   value={formatPercent(fuel)} subtitle={lastUpdated} />
            {engineOn && <MetricCard label="RPM"                   value={rpm     != null ? Math.round(rpm).toLocaleString() : "—"} subtitle={lastUpdated} />}
            {engineOn && <MetricCard label="Liquido raffreddamento" value={coolant != null ? `${Math.round(coolant)}°C`        : "—"} subtitle={lastUpdated} />}
            <MetricCard label="AdBlue"       value={adBlue   != null ? `${Math.round(adBlue)}%`      : "—"} subtitle={lastUpdated} />
            <MetricCard label="Batteria 12V" value={voltage   != null ? `${voltage.toFixed(1)}V`      : "—"} subtitle={lastUpdated} />
          </div>

          {/* ── Secondary strip ──────────────────────────────────────── */}
          {(odometer != null || extTemp != null || ignition != null || latest?.obdStatusDTCCount != null) && (
            <div
              className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 rounded-2xl mb-4"
              style={{ background: "#1e1f23" }}
            >
              {odometer != null && (
                <div className="flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5" style={{ color: "#8e9192" }} />
                  <span className="text-xs" style={{ color: "#8e9192" }}>
                    Km <span className="font-semibold text-white">{Math.round(odometer).toLocaleString()}</span>
                  </span>
                </div>
              )}
              {extTemp != null && (
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5" style={{ color: "#8e9192" }} />
                  <span className="text-xs" style={{ color: "#8e9192" }}>
                    Temp est. <span className="font-semibold text-white">{Math.round(extTemp)}°C</span>
                  </span>
                </div>
              )}
              {ignition != null && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" style={{ color: "#8e9192" }} />
                  <span className="text-xs" style={{ color: "#8e9192" }}>
                    Accensione{" "}
                    <span className="font-semibold" style={{ color: ignition ? "#4ade80" : "#8e9192" }}>
                      {ignition ? "ON" : "OFF"}
                    </span>
                  </span>
                </div>
              )}
              {latest?.obdStatusDTCCount != null && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" style={{ color: "#8e9192" }} />
                  <span className="text-xs" style={{ color: "#8e9192" }}>
                    DTC{" "}
                    <span className="font-semibold" style={{ color: latest.obdStatusDTCCount > 0 ? "#f87171" : "#4ade80" }}>
                      {latest.obdStatusDTCCount}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Charts ───────────────────────────────────────────────── */}
          {signals.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "#8e9192" }}>
              Nessun dato nel periodo selezionato — prova un intervallo più ampio.
            </p>
          ) : (
            <>
              <ChartPanel icon={Gauge}    iconColor="#3b82f6" title="Velocità (km/h)">
                <SignalChart signals={speedSignals}   field="speed"             label="Speed"   color="#3b82f6" unit="km/h" range={range} />
              </ChartPanel>
              <ChartPanel icon={Droplets} iconColor="#f59e0b" title="Livello carburante (%)">
                <SignalChart signals={fuelSignals}    field="fuelLevel"         label="Fuel"    color="#f59e0b" unit="%"    range={range} />
              </ChartPanel>
              <ChartPanel title="Giri motore (RPM)">
                <SignalChart signals={rpmSignals}     field="engineRpm"         label="RPM"     color="#8b5cf6" unit="rpm"  range={range} />
              </ChartPanel>
              <ChartPanel title="Liquido raffreddamento (°C)">
                <SignalChart signals={coolantSignals} field="engineCoolantTemp" label="Coolant" color="#ef4444" unit="°C"   range={range} />
              </ChartPanel>
            </>
          )}

          {/* ── GPS Map ──────────────────────────────────────────────── */}
          <ChartPanel title="Tracciato GPS">
            <VehicleMap locations={locations} />
          </ChartPanel>
        </>
      )}
    </div>
    </ErrorBoundary>
  );
}
