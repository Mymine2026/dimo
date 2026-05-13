"use client";

import { Component, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { TelemetrySignal, LatestStatus } from "@/types/dimo";
import { SignalChart } from "@/components/SpeedChart";
import dynamic from "next/dynamic";
const VehicleMap = dynamic(
  () => import("@/components/VehicleMap").then((m) => ({ default: m.VehicleMap })),
  { ssr: false, loading: () => <div className="rounded-xl animate-pulse" style={{ background: "#1e1f23", height: 300 }} /> }
);
import { formatSpeed, formatPercent } from "@/lib/utils";
import {
  Loader2, AlertCircle, ArrowLeft, RefreshCw, Plug,
  Zap, Gauge, Droplets, Thermometer, Route, MapPin, Wrench,
  Truck, Activity, BarChart2,
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

function extractNum(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  if (typeof raw === "object" && "value" in (raw as object)) {
    const v = (raw as Record<string, unknown>).value;
    return typeof v === "number" && isFinite(v) ? v : null;
  }
  return null;
}

function formatTimestamp(ts: string | undefined): string | undefined {
  if (!ts) return undefined;
  const date = new Date(ts);
  const now = new Date();
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isToday) return `oggi ${time}`;
  if (isYesterday) return `ieri ${time}`;
  return `${date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} ${time}`;
}

// ─── circular score ───────────────────────────────────────────────────────────

function CircularScore({ score, avgSpeed }: { score: number; avgSpeed: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#4ade80" : score >= 45 ? "#f59e0b" : "#f87171";
  const label = score >= 75 ? "Stile di guida efficiente"
              : score >= 45 ? "Stile di guida nella media"
              : "Velocità non ottimale";

  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
      <div className="flex items-center gap-4">
        <svg width="72" height="72" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#2a2b30" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
          />
          <text
            x="36" y="36"
            textAnchor="middle" dominantBaseline="central"
            fill={color} fontSize="15" fontWeight="700"
            style={{ transform: "rotate(90deg)", transformOrigin: "36px 36px" }}
          >
            {score}
          </text>
        </svg>
        <div>
          <p className="font-bold text-white" style={{ fontSize: 15 }}>Punteggio di guida</p>
          <p style={{ fontSize: 12, color, marginTop: 2, fontWeight: 600 }}>{label}</p>
          <p style={{ fontSize: 11, color: "#8e9192", marginTop: 4 }}>
            Vel. media in marcia: <span className="text-white font-semibold">{Math.round(avgSpeed)} km/h</span>
          </p>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 10, borderTop: "1px solid #2a2b30", paddingTop: 8 }}>
        Punteggio 0–100 basato sulla velocità media in marcia nel periodo selezionato. Ottimale tra 70 e 85 km/h per veicoli commerciali. Non include i periodi di sosta.
      </p>
    </div>
  );
}

// ─── metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, subtitle, info }: { label: string; value: string; subtitle?: string; info?: string }) {
  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
      <p
        className="font-semibold tracking-widest uppercase"
        style={{ fontSize: 10, color: "#8e9192", marginBottom: 8 }}
      >
        {label}
      </p>
      <p className="font-bold leading-none text-white" style={{ fontSize: 28 }}>{value}</p>
      {info && (
        <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 6 }}>{info}</p>
      )}
      {subtitle && (
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: info ? 2 : 8 }}>{subtitle}</p>
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
        {Icon && (
          <div
            className="flex items-center justify-center"
            style={{ width: 24, height: 24, background: iconColor ? `${iconColor}22` : "#29292e", borderRadius: 6 }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: iconColor ?? "#8e9192" }} />
          </div>
        )}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
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
  const [vehicleName,    setVehicleName]    = useState<string>(`Veicolo #${tokenId}`);
  const [monitoringStart, setMonitoringStart] = useState<string | null>(null);
  const firstLoad = useRef(true);

  async function loadVehicleName() {
    try {
      const res  = await fetch("/api/vehicles");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const v = data.find((v: { tokenId: number }) => String(v.tokenId) === String(tokenId));
        if (v?.definition) {
          setVehicleName(`${v.definition.make} ${v.definition.model}`);
        }
      }
    } catch { /* non-critical */ }
  }

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

  async function loadMonitoringStart() {
    try {
      const from = "2024-01-01T00:00:00Z";
      const to   = new Date().toISOString();
      const res  = await fetch(`/api/telemetry?tokenId=${tokenId}&from=${from}&to=${to}&interval=720h`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const first = (data as TelemetrySignal[]).find(s => s.accumulatedConsumption != null);
        if (first) setMonitoringStart(first.timestamp);
      }
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    loadVehicleName();
    loadTelemetry(true);
    loadLatest();
    loadMonitoringStart();
    firstLoad.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId]);

  useEffect(() => {
    if (firstLoad.current) return;
    loadTelemetry(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const lastSignal  = signals.at(-1);
  const lastUpdated = formatTimestamp(lastSignal?.timestamp);

  const speed               = extractNum(latest?.speed)                                             ?? lastSignal?.speed;
  const fuel                = extractNum(latest?.powertrainFuelSystemRelativeLevel)                 ?? lastSignal?.fuelLevel;
  const rpm                 = extractNum(latest?.powertrainCombustionEngineSpeed)                   ?? lastSignal?.engineRpm;
  const coolant             = extractNum(latest?.powertrainCombustionEngineECT)                     ?? lastSignal?.engineCoolantTemp;
  const adBlue              = extractNum(latest?.powertrainCombustionEngineDieselExhaustFluidLevel) ?? lastSignal?.adBlue;
  const voltage             = extractNum(latest?.lowVoltageBatteryCurrentVoltage)                   ?? lastSignal?.batteryVoltage;
  const odometer            = extractNum(latest?.powertrainTransmissionTravelledDistance)           ?? lastSignal?.odometer;
  const extTemp             = extractNum(latest?.exteriorAirTemperature)                            ?? lastSignal?.exteriorTemp;
  const ignition            = extractNum(latest?.isIgnitionOn)                                      ?? lastSignal?.isIgnitionOn;
  const torquePercent       = extractNum(latest?.powertrainCombustionEngineTorquePercent)           ?? lastSignal?.torquePercent;
  const accumulatedFuel     = extractNum(latest?.powertrainFuelSystemAccumulatedConsumption)        ?? lastSignal?.accumulatedConsumption;
  const engineOn = ignition == null || Number(ignition) !== 0;

  // Fuel consumption delta for selected period (accumulated consumption last - first non-null)
  const fuelWithAcc = signals.filter(s => s.accumulatedConsumption != null);
  const periodFuelDelta = fuelWithAcc.length >= 2
    ? Math.round(fuelWithAcc.at(-1)!.accumulatedConsumption! - fuelWithAcc[0]!.accumulatedConsumption!)
    : null;

  // Filter each chart to its non-null data points — avoids gaps from unsampled intervals
  const speedSignals    = signals;                                         // speed always present (0 when parked)
  const fuelSignals     = signals.filter(s => s.fuelLevel != null);
  const rpmSignals      = signals.filter(s => s.engineRpm != null);
  const coolantSignals  = signals.filter(s => s.engineCoolantTemp != null);
  const torqueSignals   = signals.filter(s => s.torquePercent != null);

  const locations = signals
    .filter(s => s.location?.latitude != null && s.location?.longitude != null)
    .map(s => ({ timestamp: s.timestamp, latitude: s.location!.latitude, longitude: s.location!.longitude }));

  const dtcCount = latest?.obdStatusDTCCount ?? null;

  // Punteggio di guida: basato sulla velocità media in marcia (solo campioni > 5 km/h).
  // Ottimale per veicoli commerciali: 70-85 km/h. Min 5 campioni per mostrare il dato.
  const movingSpeeds  = signals.map(s => s.speed).filter((v): v is number => v != null && v > 5);
  const avgSpeed      = movingSpeeds.length >= 5
    ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length
    : null;
  const drivingScore  = avgSpeed != null
    ? Math.min(100, Math.max(0, Math.round(100 - Math.abs(avgSpeed - 78) * 1.1)))
    : null;

  function torqueLabel(t: number): string {
    if (t <= -10) return "Freno motore attivo";
    if (t >= 10)  return "Motore in trazione";
    return "Motore al minimo";
  }

  return (
    <ErrorBoundary>
    <div className="px-4 pt-6 pb-8" style={{ minHeight: "100vh" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/vehicles">
            <div
              className="flex items-center justify-center"
              style={{ width: 38, height: 38, background: "#1e1f23", borderRadius: 12 }}
            >
              <ArrowLeft className="w-4 h-4" style={{ color: "#ffffff" }} />
            </div>
          </Link>
          <div>
            <h1 className="font-bold text-white leading-tight" style={{ fontSize: 24 }}>
              {vehicleName}
            </h1>
            <p style={{ fontSize: 12, color: "#8e9192", marginTop: 1 }}>Telemetria</p>
          </div>
        </div>
        <button
          onClick={() => { loadTelemetry(false); loadLatest(); }}
          disabled={loading}
          className="flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{ width: 38, height: 38, background: "#1e1f23", borderRadius: 12 }}
          aria-label="Aggiorna"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            style={{ color: "#ffffff" }}
          />
        </button>
      </div>

      {/* ── Vehicle info card ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 rounded-2xl p-4 mb-5"
        style={{ background: "#ffffff" }}
      >
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 56, height: 56, background: "#f3f4f6", borderRadius: 16 }}
        >
          <Truck className="w-7 h-7" style={{ color: "#374151" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight truncate" style={{ fontSize: 17, color: "#111827" }}>
            {vehicleName}
          </p>
          <p className="text-sm truncate" style={{ color: "#6b7280", marginTop: 2 }}>
            Token #{tokenId}
          </p>
        </div>
        {latest && (
          <div className="shrink-0 flex items-center gap-1.5">
            <span
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block" }}
            />
            <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>Online</span>
          </div>
        )}
      </div>

      {/* ── Range pills ────────────────────────────────────────────────── */}
      <div className="mb-2">
        <div className="flex gap-2">
          {RANGES.map((r) => {
            const active = r.value === range;
            return (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className="flex-1 text-xs font-semibold py-2 rounded-full transition-colors"
                style={{
                  background: active ? "#ffffff" : "#1e1f23",
                  color:      active ? "#000000" : "#8e9192",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6, marginBottom: 12 }}>
          Il periodo selezionato aggiorna i grafici e il punteggio di guida. I valori in tempo reale (velocità, carburante, ecc.) sono sempre aggiornati all&apos;ultimo dato ricevuto dal sensore.
        </p>
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
            <MetricCard label="Velocità"     value={formatSpeed(ignition != null && Number(ignition) === 0 ? null : speed)}  subtitle={lastUpdated} />
            <MetricCard label="Carburante"   value={formatPercent(fuel)} subtitle={lastUpdated} />
            {engineOn && (
              <MetricCard
                label="RPM"
                value={rpm != null ? Math.round(rpm).toLocaleString() : "—"}
                subtitle={lastUpdated}
              />
            )}
            {engineOn && (
              <MetricCard
                label="Raffr. motore"
                value={coolant != null ? `${Math.round(coolant)}°C` : "—"}
                subtitle={lastUpdated}
              />
            )}
            <MetricCard
              label="AdBlue"
              value={adBlue != null ? `${Math.round(adBlue)}%` : "—"}
              subtitle={lastUpdated}
            />
            <MetricCard
              label="Batteria 12V"
              value={voltage != null ? `${voltage.toFixed(1)}V` : "—"}
              subtitle={lastUpdated}
            />
            {torquePercent != null && (
              <MetricCard
                label="Coppia motore"
                value={`${Math.round(torquePercent)}%`}
                info={torqueLabel(torquePercent)}
                subtitle="Scala –125%..+125% (J1939)"
              />
            )}
            {accumulatedFuel != null && (
              <MetricCard
                label="Carburante totale"
                value={`${Math.round(accumulatedFuel).toLocaleString()} L`}
                info={monitoringStart
                  ? `Dal ${new Date(monitoringStart).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}`
                  : "Dall'inizio del monitoraggio"}
                subtitle="Contatore totale · non varia col periodo"
              />
            )}
            {periodFuelDelta != null && periodFuelDelta > 0 && (
              <MetricCard
                label="Consumo nel periodo"
                value={`${periodFuelDelta.toLocaleString()} L`}
                info={`Variazione nel periodo selezionato (${range})`}
              />
            )}
          </div>

          {/* ── Status strip ─────────────────────────────────────────── */}
          {(odometer != null || extTemp != null || ignition != null || dtcCount != null) && (
            <div
              className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 mb-4"
              style={{ background: "#1e1f23", borderRadius: 12 }}
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
                    Quadro{" "}
                    <span className="font-semibold" style={{ color: Number(ignition) !== 0 ? "#4ade80" : "#8e9192" }}>
                      {Number(ignition) !== 0 ? "Acceso" : "Spento"}
                    </span>
                  </span>
                </div>
              )}
              {dtcCount != null && (
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" style={{ color: "#8e9192" }} />
                  <span className="text-xs" style={{ color: "#8e9192" }}>
                    DTC{" "}
                    <span className="font-semibold" style={{ color: dtcCount > 0 ? "#f87171" : "#4ade80" }}>
                      {dtcCount}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── AdBlue alert ─────────────────────────────────────────── */}
          {adBlue != null && adBlue < 25 && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
              style={{
                background: adBlue < 10 ? "rgba(239,68,68,0.08)" : "rgba(251,191,36,0.08)",
                border: `1px solid ${adBlue < 10 ? "rgba(239,68,68,0.22)" : "rgba(251,191,36,0.22)"}`,
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: adBlue < 10 ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.12)",
                }}
              >
                <Droplets className="w-5 h-5" style={{ color: adBlue < 10 ? "#f87171" : "#fbbf24" }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: adBlue < 10 ? "#f87171" : "#fcd34d" }}>
                  AdBlue al {Math.round(adBlue)}%{adBlue < 10 ? " — Rifornire urgentemente" : " — Livello basso"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: adBlue < 10 ? "#fca5a5" : "#fde68a" }}>
                  Rifornire per evitare limitazioni del motore
                </p>
              </div>
            </div>
          )}

          {/* ── DTC diagnostics ──────────────────────────────────────── */}
          {dtcCount != null && dtcCount > 0 && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, background: "rgba(239,68,68,0.12)", borderRadius: 10 }}
              >
                <Activity className="w-5 h-5" style={{ color: "#f87171" }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "#f87171" }}>
                  {dtcCount} codice{dtcCount > 1 ? "i" : ""} DTC rilevato{dtcCount > 1 ? "i" : ""}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#fca5a5" }}>
                  Portare il veicolo in officina per la diagnosi
                </p>
              </div>
            </div>
          )}

          {/* ── Driving score ────────────────────────────────────────── */}
          {drivingScore != null && avgSpeed != null && (
            <div className="mb-4">
              <CircularScore score={drivingScore} avgSpeed={avgSpeed} />
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
              <ChartPanel icon={Zap}      iconColor="#8b5cf6" title="Giri motore (RPM)">
                <SignalChart signals={rpmSignals}     field="engineRpm"         label="RPM"     color="#8b5cf6" unit="rpm"  range={range} />
              </ChartPanel>
              <ChartPanel icon={Thermometer} iconColor="#ef4444" title="Liquido raffreddamento (°C)">
                <SignalChart signals={coolantSignals} field="engineCoolantTemp" label="Coolant" color="#ef4444" unit="°C"   range={range} />
              </ChartPanel>
              {torqueSignals.length > 0 && (
                <ChartPanel icon={BarChart2} iconColor="#f97316" title="Coppia motore (%)">
                  <SignalChart signals={torqueSignals} field="torquePercent" label="Torque" color="#f97316" unit="%" range={range} />
                  <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
                    Scala –125% (freno motore massimo) · 0% (minimo) · +125% (trazione massima). Valori negativi indicano che il motore sta frenando il veicolo (es. in discesa o in decelerazione).
                  </p>
                </ChartPanel>
              )}
            </>
          )}

          {/* ── GPS Map ──────────────────────────────────────────────── */}
          <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
              <div
                className="flex items-center justify-center"
                style={{ width: 24, height: 24, background: "#22c55e22", borderRadius: 6 }}
              >
                <MapPin className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
              </div>
              <h3 className="text-sm font-semibold text-white">Percorso GPS</h3>
            </div>
            <div style={{ borderRadius: 12, overflow: "hidden" }}>
              <VehicleMap locations={locations} height="350px" />
            </div>
          </div>
        </>
      )}
    </div>
    </ErrorBoundary>
  );
}
