"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TelemetrySignal, LatestStatus } from "@/types/dimo";
import { SignalChart } from "@/components/SpeedChart";
import { VehicleMap } from "@/components/VehicleMap";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { formatSpeed, formatPercent, formatKm } from "@/lib/utils";
import { Loader2, AlertCircle, ArrowLeft, RefreshCw, Plug, Zap, Gauge, Droplets, Thermometer, Route } from "lucide-react";
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

export default function VehicleDetailPage() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [signals,       setSignals]       = useState<TelemetrySignal[]>([]);
  const [latest,        setLatest]        = useState<LatestStatus | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [range,         setRange]         = useState<Range>("30d");
  const [neverConnected, setNeverConnected] = useState(false);
  const firstLoad = useRef(true);

  async function loadTelemetry(checkConnected = false) {
    setLoading(true);
    setError(null);
    const hours = RANGES.find((r) => r.value === range)?.hours ?? 720;
    // For the initial connectivity check, always use 90d
    const queryHours = checkConnected ? 2160 : hours;
    const from = new Date(Date.now() - queryHours * 60 * 60 * 1000).toISOString();
    const to   = new Date().toISOString();
    try {
      const res  = await fetch(`/api/telemetry?tokenId=${tokenId}&hours=${queryHours}&from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch telemetry");
      if (checkConnected) {
        setNeverConnected(data.length === 0);
        // If 90d has data but selected range might be narrower, reload for selected range
        if (data.length > 0 && hours !== queryHours) {
          const r2   = await fetch(`/api/telemetry?tokenId=${tokenId}&hours=${hours}`);
          const d2   = await r2.json();
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
    } catch { /* latest status is non-critical */ }
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
  // Use latest status if available, otherwise fall back to last signal
  const speed    = latest?.speed                                              ?? lastSignal?.speed;
  const fuel     = latest?.powertrainFuelSystemRelativeLevel                  ?? lastSignal?.fuelLevel;
  const rpm      = latest?.powertrainCombustionEngineSpeed                    ?? lastSignal?.engineRpm;
  const coolant  = latest?.powertrainCombustionEngineECT                      ?? lastSignal?.engineCoolantTemp;
  const adBlue   = latest?.powertrainCombustionEngineDieselExhaustFluidLevel  ?? lastSignal?.adBlue;
  const voltage  = latest?.lowVoltageBatteryCurrentVoltage                    ?? lastSignal?.batteryVoltage;
  const odometer = latest?.powertrainTransmissionTravelledDistance            ?? lastSignal?.odometer;
  const extTemp  = latest?.exteriorAirTemperature                             ?? lastSignal?.exteriorTemp;
  const ignition = latest?.isIgnitionOn                                       ?? lastSignal?.isIgnitionOn;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/vehicles" className="text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-white">Vehicle #{tokenId}</h2>
            <p className="text-zinc-400 mt-0.5 text-sm">Telemetry Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === r.value ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { loadTelemetry(false); loadLatest(); }}
            disabled={loading}
            className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && neverConnected && DIMO_CONFIG_ID && (
        <div className="flex items-center justify-between bg-amber-900/20 border border-amber-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <Plug className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">Vehicle not connected to this app</p>
              <p className="text-xs text-amber-500 mt-0.5">Authorize data sharing via DIMO Connect to see telemetry</p>
            </div>
          </div>
          <a href={dimoConnectUrl()} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
            Connect Vehicle →
          </a>
        </div>
      )}

      {loading && signals.length === 0 ? (
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading telemetry…
        </div>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Card>
              <CardTitle>Speed</CardTitle>
              <CardValue>{formatSpeed(speed)}</CardValue>
            </Card>
            <Card>
              <CardTitle>Fuel</CardTitle>
              <CardValue>{formatPercent(fuel)}</CardValue>
            </Card>
            <Card>
              <CardTitle>RPM</CardTitle>
              <CardValue>{rpm != null ? Math.round(rpm).toLocaleString() : "—"}</CardValue>
            </Card>
            <Card>
              <CardTitle>Coolant</CardTitle>
              <CardValue>{coolant != null ? `${Math.round(coolant)}°C` : "—"}</CardValue>
            </Card>
            <Card>
              <CardTitle>AdBlue</CardTitle>
              <CardValue>{adBlue != null ? `${Math.round(adBlue)}%` : "—"}</CardValue>
            </Card>
            <Card>
              <CardTitle>12V Battery</CardTitle>
              <CardValue>{voltage != null ? `${voltage.toFixed(1)}V` : "—"}</CardValue>
            </Card>
          </div>

          {/* Secondary info strip */}
          <div className="flex flex-wrap gap-4 mb-6 px-1">
            {odometer != null && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Route className="w-4 h-4 text-zinc-500" />
                <span>Odometer <span className="text-white font-medium">{Math.round(odometer).toLocaleString()} km</span></span>
              </div>
            )}
            {extTemp != null && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Thermometer className="w-4 h-4 text-zinc-500" />
                <span>Ext. temp <span className="text-white font-medium">{Math.round(extTemp)}°C</span></span>
              </div>
            )}
            {ignition != null && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Zap className="w-4 h-4 text-zinc-500" />
                <span>Ignition <span className={ignition ? "text-emerald-400 font-medium" : "text-zinc-500 font-medium"}>{ignition ? "ON" : "OFF"}</span></span>
              </div>
            )}
            {latest?.obdStatusDTCCount != null && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <AlertCircle className="w-4 h-4 text-zinc-500" />
                <span>DTC codes <span className={latest.obdStatusDTCCount > 0 ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}>{latest.obdStatusDTCCount}</span></span>
              </div>
            )}
          </div>

          {/* Charts */}
          {signals.length === 0 ? (
            <p className="text-zinc-500 text-sm mb-6">No data in this time period — try a wider range.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-zinc-400">Speed (km/h)</h3>
                </div>
                <SignalChart signals={signals} field="speed" label="Speed" color="#3b82f6" unit="km/h" />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Droplets className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-medium text-zinc-400">Fuel level (%)</h3>
                </div>
                <SignalChart signals={signals} field="fuelLevel" label="Fuel" color="#f59e0b" unit="%" />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">Engine RPM</h3>
                <SignalChart signals={signals} field="engineRpm" label="RPM" color="#8b5cf6" unit="rpm" />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">Coolant temp (°C)</h3>
                <SignalChart signals={signals} field="engineCoolantTemp" label="Coolant" color="#ef4444" unit="°C" />
              </div>
            </div>
          )}

          {/* GPS Map */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">GPS Track</h3>
            <VehicleMap signals={signals} />
          </div>
        </>
      )}
    </div>
  );
}
