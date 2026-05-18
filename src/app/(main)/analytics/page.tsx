"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  AlertTriangle, BarChart2, ChevronDown, Route, Wrench, X,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

interface VehicleItem {
  tokenId: number;
  definition: { make: string; model: string; year: number };
}

interface MaintenanceRecord {
  id: number;
  type: string;
  date: string | null;
  km_at_service: number | null;
  next_service_km: number | null;
  notes: string | null;
  created_at: string;
}

interface Signal {
  timestamp: string;
  speed?: number | null;
  location?: { latitude: number; longitude: number } | null;
}

interface TripSession {
  startTime: Date;
  endTime: Date;
  km: number;
  durationMin: number;
  startCoords: { latitude: number; longitude: number };
  endCoords:   { latitude: number; longitude: number };
}

interface DayGroup {
  label: string;
  isoDate: string;
  totalKm: number;
  sessions: TripSession[];
}

// ─── period ───────────────────────────────────────────────────────────────────

type Period = "oggi" | "7gg" | "30gg" | "mese";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Oggi",    value: "oggi" },
  { label: "7 gg",   value: "7gg"  },
  { label: "30 gg",  value: "30gg" },
  { label: "Mese",   value: "mese" },
];

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  if (period === "oggi") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (period === "7gg") {
    return { from: new Date(Date.now() - 7 * 24 * 3_600_000), to: now };
  }
  if (period === "30gg") {
    return { from: new Date(Date.now() - 30 * 24 * 3_600_000), to: now };
  }
  // mese corrente
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from, to: now };
}

function periodTitle(period: Period): string {
  if (period === "oggi") return "Oggi";
  if (period === "7gg")  return "7 giorni";
  if (period === "30gg") return "30 giorni";
  return "Mese corrente";
}

// Genera una barra per ogni giorno del periodo (inclusi giorni a 0 km)
function buildChartData(period: Period, days: DayGroup[]) {
  const { from, to } = getPeriodRange(period);
  const dayMap = new Map(days.map(d => [d.isoDate, d.totalKm]));

  const result: { label: string; fullLabel: string; isoDate: string; km: number }[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    const weekday = cur.toLocaleDateString("it-IT", { weekday: "short" });
    const dateStr = `${cur.getDate()}/${cur.getMonth() + 1}`;
    result.push({
      label:     period === "30gg" || period === "mese" ? dateStr : `${weekday} ${dateStr}`,
      fullLabel: `${weekday} ${dateStr}`,
      isoDate:   iso,
      km:        dayMap.get(iso) ?? 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ─── trip logic ───────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildSessions(signals: Signal[]): TripSession[] {
  const sorted = [...signals].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  if (sorted.length < 2) return [];

  const sessions: TripSession[] = [];
  let current: Signal[] = [];
  let currentKm = 0;

  const flush = () => {
    if (current.length >= 2 && currentKm > 1) {
      const t0 = new Date(current[0].timestamp);
      const t1 = new Date(current[current.length - 1].timestamp);
      const startCoords = current.find(s => s.location?.latitude != null)?.location ?? null;
      const endCoords   = [...current].reverse().find(s => s.location?.latitude != null)?.location ?? null;
      if (startCoords && endCoords) {
        sessions.push({
          startTime:   t0,
          endTime:     t1,
          km:          currentKm,
          durationMin: Math.round((t1.getTime() - t0.getTime()) / 60_000),
          startCoords,
          endCoords,
        });
      }
    }
    current = [];
    currentKm = 0;
  };

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const ms = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();

    const gpsKm = prev.location && curr.location
      ? haversineKm(prev.location.latitude, prev.location.longitude, curr.location.latitude, curr.location.longitude)
      : 0;
    const impliedKmh = ms > 0 ? gpsKm / (ms / 3_600_000) : Infinity;
    const anomalous  = impliedKmh > 200;

    // Movement detected by speed (Trafic) OR GPS displacement ≥ 0.5 km (Iveco / low-speed reporters)
    const gpsMoving   = gpsKm >= 0.5 && !anomalous;
    const speedMoving = ((prev.speed ?? 0) > 2 || (curr.speed ?? 0) > 2) && !anomalous;

    if (speedMoving || gpsMoving) {
      if (current.length === 0) current.push(prev);
      current.push(curr);
      currentKm += gpsKm;
    } else {
      flush();
    }
  }
  flush();

  return sessions;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { "Accept-Language": "it", "User-Agent": "Conexo-Fleet/1.0" } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  const a = d.address ?? {};
  return (
    [a.road, a.city ?? a.town ?? a.village ?? a.county].filter(Boolean).join(", ") ||
    d.display_name?.split(",")[0] ||
    `${lat.toFixed(3)}, ${lon.toFixed(3)}`
  );
}

function geoKey(c: { latitude: number; longitude: number }) {
  return `${c.latitude.toFixed(3)},${c.longitude.toFixed(3)}`;
}

function groupByDay(sessions: TripSession[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of [...sessions].sort(
    (a, b) => b.startTime.getTime() - a.startTime.getTime()
  )) {
    const iso = s.startTime.toISOString().slice(0, 10);
    const label = s.startTime.toLocaleDateString("it-IT", {
      weekday: "short", day: "2-digit", month: "2-digit",
    });
    if (!map.has(iso)) map.set(iso, { label, isoDate: iso, totalKm: 0, sessions: [] });
    const g = map.get(iso)!;
    g.sessions.push(s);
    g.totalKm += s.km;
  }
  // Discard daily totals > 3000 km — GPS runaway guard
  return Array.from(map.values()).filter(g => g.totalKm <= 3000);
}

function fmtDur(min: number) {
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

// ─── small UI helpers ─────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, color, title }: { icon: React.ElementType; color: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="flex items-center justify-center"
        style={{ width: 28, height: 28, background: `${color}22`, borderRadius: 8 }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <h2 className="font-semibold text-white" style={{ fontSize: 14 }}>{title}</h2>
    </div>
  );
}

// ─── tooltip personalizzato ───────────────────────────────────────────────────

function KmTooltip({ active, payload }: { active?: boolean; payload?: { payload: { fullLabel: string; km: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { fullLabel, km } = payload[0].payload;
  return (
    <div
      style={{
        background: "#1e1f23", border: "1px solid #2a2b30", borderRadius: 10,
        padding: "8px 12px", fontSize: 12,
      }}
    >
      <p className="font-bold text-white">{km} km</p>
      <p style={{ color: "#8e9192", marginTop: 2 }}>{fullLabel}</p>
    </div>
  );
}

// ─── modal ────────────────────────────────────────────────────────────────────

interface ModalField { label: string; key: string; type: "text" | "number" | "date"; placeholder?: string }

function FormModal({
  title, fields, onClose, onSave,
}: {
  title: string;
  fields: ModalField[];
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try { await onSave(values); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl p-6"
        style={{ background: "#18191c" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white" style={{ fontSize: 18 }}>{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "#8e9192" }} /></button>
        </div>
        {fields.map((f) => (
          <div key={f.key} className="mb-4">
            <p className="text-xs font-semibold mb-1" style={{ color: "#8e9192" }}>{f.label}</p>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
              style={{ background: "#1e1f23", border: "1px solid #2a2b30" }}
            />
          </div>
        ))}
        <button
          onClick={submit}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-sm mt-1 disabled:opacity-50"
          style={{ background: "#ffffff", color: "#000" }}
        >
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

type ModalType = "tagliando" | "gomme" | null;

export default function AnalyticsPage() {
  const [vehicles, setVehicles]         = useState<VehicleItem[]>([]);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [showVehicles, setShowVehicles] = useState(false);
  const [period, setPeriod]             = useState<Period>("7gg");

  const [adBlue, setAdBlue]             = useState<number | null>(null);
  const [odometer, setOdometer]         = useState<number | null>(null);

  const [maintenance, setMaintenance]   = useState<MaintenanceRecord[]>([]);
  const [sessions, setSessions]         = useState<TripSession[]>([]);

  const [loadingMain, setLoadingMain]   = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const [modal, setModal]               = useState<ModalType>(null);
  const [geoLabels, setGeoLabels]       = useState<Map<string, string>>(new Map());
  const geocodeCacheRef                 = useRef(new Map<string, string>());

  // ── load vehicles ──
  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((data: VehicleItem[]) => {
        if (Array.isArray(data) && data.length) {
          setVehicles(data);
          setSelectedId(data[0].tokenId);
        }
      })
      .catch(() => {});
  }, []);

  // ── load data when vehicle or period changes ──
  const loadData = useCallback(async (tokenId: number, p: Period) => {
    setAdBlue(null); setOdometer(null); setMaintenance([]); setSessions([]); setGeoLabels(new Map());
    setLoadingMain(true); setLoadingTrips(true);

    fetch(`/api/latest?tokenId=${tokenId}`)
      .then((r) => r.json())
      .then((d) => {
        setAdBlue(d.powertrainCombustionEngineDieselExhaustFluidLevel ?? null);
        setOdometer(d.powertrainTransmissionTravelledDistance ?? null);
      })
      .catch(() => {});

    fetch(`/api/maintenance?tokenId=${tokenId}`)
      .then((r) => r.json())
      .then((d: MaintenanceRecord[]) => Array.isArray(d) ? setMaintenance(d) : null)
      .catch(() => {})
      .finally(() => setLoadingMain(false));

    const { from, to } = getPeriodRange(p);
    const fromStr = from.toISOString();
    const toStr   = to.toISOString();

    fetch(`/api/telemetry?tokenId=${tokenId}&from=${fromStr}&to=${toStr}&interval=1h&slim=1`)
      .then((r) => r.json())
      .then((d: Signal[]) => Array.isArray(d) ? setSessions(buildSessions(d)) : setSessions([]))
      .catch(() => setSessions([]))
      .finally(() => setLoadingTrips(false));
  }, []);

  useEffect(() => {
    if (selectedId != null) loadData(selectedId, period);
  }, [selectedId, period, loadData]);

  // ── geocode start/end coords for each session ──
  useEffect(() => {
    if (!sessions.length) return;
    const toFetch: { key: string; lat: number; lon: number }[] = [];
    const fromCache = new Map<string, string>();
    for (const s of sessions) {
      for (const c of [s.startCoords, s.endCoords]) {
        if (!c) continue;
        const k = geoKey(c);
        const cached = geocodeCacheRef.current.get(k);
        if (cached) { fromCache.set(k, cached); }
        else { toFetch.push({ key: k, lat: c.latitude, lon: c.longitude }); }
      }
    }
    if (fromCache.size) setGeoLabels(m => { const n = new Map(m); fromCache.forEach((v, k) => n.set(k, v)); return n; });
    const unique = [...new Map(toFetch.map(c => [c.key, c])).values()];
    if (!unique.length) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < unique.length; i++) {
        if (cancelled) break;
        if (i > 0) await new Promise(r => setTimeout(r, 1200));
        if (cancelled) break;
        const { key, lat, lon } = unique[i];
        try {
          const label = await reverseGeocode(lat, lon);
          geocodeCacheRef.current.set(key, label);
          if (!cancelled) setGeoLabels(m => { const n = new Map(m); n.set(key, label); return n; });
        } catch {
          geocodeCacheRef.current.set(key, `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sessions]);

  // ── maintenance helpers ──
  const tagliando = maintenance.filter((m) => m.type === "tagliando").sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0] ?? null;
  const gomme = maintenance.filter((m) => m.type === "gomme").sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0] ?? null;

  const kmLeft = tagliando?.next_service_km != null && odometer != null
    ? tagliando.next_service_km - Math.round(odometer)
    : null;

  const progressColor =
    kmLeft == null ? "#4ade80"
    : kmLeft < 1000 ? "#f87171"
    : kmLeft < 5000 ? "#fbbf24"
    : "#4ade80";

  const progressPct =
    kmLeft == null ? 100
    : tagliando?.km_at_service != null
      ? Math.max(0, Math.min(100, (kmLeft / (tagliando.next_service_km! - tagliando.km_at_service!)) * 100))
    : Math.max(0, Math.min(100, (kmLeft / 15000) * 100));

  const gommeDateStr = gomme?.date
    ? new Date(gomme.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  const gommeKmAgo = gomme?.km_at_service != null && odometer != null
    ? Math.round(odometer) - gomme.km_at_service
    : null;

  const days = groupByDay(sessions);
  const selectedVehicle = vehicles.find((v) => v.tokenId === selectedId);

  // ── stats ──
  const totalKm    = sessions.reduce((s, t) => s + t.km, 0);
  const activeDays = days.filter(d => d.totalKm > 0).length;
  const avgKmDay   = activeDays > 0 ? Math.round(totalKm / activeDays) : 0;

  // ── chart data ──
  const chartData = buildChartData(period, days);
  const hasChartData = chartData.some(d => d.km > 0);

  // ── save helpers ──
  async function saveMaintenance(values: Record<string, string>, type: string) {
    await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId: selectedId,
        type,
        date: values.date || null,
        km_at_service: values.km_at_service ? Number(values.km_at_service) : null,
        next_service_km: values.next_service_km ? Number(values.next_service_km) : null,
        notes: values.notes || null,
      }),
    });
    if (selectedId) loadData(selectedId, period);
  }

  // ── render ──
  return (
    <div className="px-4 pt-6 pb-8" style={{ minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="mb-5">
        <img src="/conexo-logo.png" alt="Conexo Technologies" style={{ height: 32 }} />
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>
      <h1 className="font-bold text-white mb-4" style={{ fontSize: 28 }}>Analytics</h1>

      {/* ── Vehicle picker ── */}
      {vehicles.length > 0 && (
        <div className="relative mb-4">
          <button
            onClick={() => setShowVehicles((v) => !v)}
            className="flex items-center justify-between w-full rounded-2xl px-4 py-3"
            style={{ background: "#1e1f23" }}
          >
            <span className="text-sm font-semibold text-white">
              {selectedVehicle
                ? `${selectedVehicle.definition.year} ${selectedVehicle.definition.make} ${selectedVehicle.definition.model}`
                : "Seleziona veicolo"}
            </span>
            <ChevronDown className="w-4 h-4" style={{ color: "#8e9192" }} />
          </button>
          {showVehicles && (
            <div
              className="absolute z-10 w-full mt-1 rounded-2xl overflow-hidden"
              style={{ background: "#1e1f23", border: "1px solid #2a2b30" }}
            >
              {vehicles.map((v) => (
                <button
                  key={v.tokenId}
                  onClick={() => { setSelectedId(v.tokenId); setShowVehicles(false); }}
                  className="flex items-center w-full px-4 py-3 text-sm text-left"
                  style={{
                    color: v.tokenId === selectedId ? "#ffffff" : "#8e9192",
                    borderBottom: "1px solid #2a2b30",
                  }}
                >
                  {v.definition.year} {v.definition.make} {v.definition.model}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedId == null ? (
        <p className="text-sm text-center py-16" style={{ color: "#8e9192" }}>
          Nessun veicolo disponibile.
        </p>
      ) : (
        <>
          {/* ── Period selector ── */}
          <div className="flex gap-2 mb-4">
            {PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className="flex-1 text-xs font-semibold py-2 rounded-full transition-colors"
                  style={{
                    background: active ? "#3b82f6" : "#1e1f23",
                    color:      active ? "#ffffff" : "#8e9192",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* ── Stats row ── */}
          {!loadingTrips && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "Km totali",  value: Math.round(totalKm).toLocaleString(), color: "#3b82f6" },
                { label: "Sessioni",   value: sessions.length,                       color: "#8b5cf6" },
                { label: "Km/giorno",  value: avgKmDay.toLocaleString(),             color: "#4ade80" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center rounded-2xl py-3" style={{ background: "#1e1f23" }}>
                  <span className="font-bold leading-none" style={{ fontSize: 20, color }}>{value}</span>
                  <span className="font-semibold tracking-wider uppercase mt-1" style={{ fontSize: 9, color: "#8e9192" }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Km giornalieri BarChart ── */}
          <Card style={{ marginBottom: 12 }}>
            <SectionTitle icon={BarChart2} color="#3b82f6" title={`Km giornalieri · ${periodTitle(period)}`} />

            {loadingTrips ? (
              <div style={{ height: 200 }} className="flex items-center justify-center">
                <p className="text-xs" style={{ color: "#8e9192" }}>Caricamento…</p>
              </div>
            ) : !hasChartData ? (
              <div style={{ height: 200 }} className="flex items-center justify-center">
                <p className="text-xs" style={{ color: "#8e9192" }}>Nessun dato disponibile per questo periodo</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "#8e9192" }}
                    tickLine={false}
                    axisLine={false}
                    interval={period === "30gg" || period === "mese" ? 4 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#8e9192" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}km`}
                  />
                  <Tooltip content={<KmTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="km" radius={[4, 4, 2, 2]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.km > 0 ? "url(#barGrad)" : "#2a2b30"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* ── AdBlue banner ── */}
          {adBlue != null && adBlue < 25 && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
              style={{
                background: adBlue < 10 ? "rgba(239,68,68,0.10)" : "rgba(251,191,36,0.10)",
                border: `1px solid ${adBlue < 10 ? "rgba(239,68,68,0.25)" : "rgba(251,191,36,0.25)"}`,
              }}
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0"
                style={{ color: adBlue < 10 ? "#f87171" : "#fbbf24" }}
              />
              <p className="text-sm font-semibold" style={{ color: adBlue < 10 ? "#fca5a5" : "#fcd34d" }}>
                {adBlue < 10
                  ? `AdBlue al ${Math.round(adBlue)}% — Rifornire presto`
                  : `AdBlue al ${Math.round(adBlue)}% — Livello basso`}
              </p>
            </div>
          )}

          {/* ── Manutenzione ── */}
          <Card>
            <SectionTitle icon={Wrench} color="#f59e0b" title="Manutenzione" />

            {loadingMain ? (
              <p className="text-xs py-4 text-center" style={{ color: "#8e9192" }}>Caricamento…</p>
            ) : (
              <>
                <div className="rounded-xl p-3 mb-3" style={{ background: "#14151a" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-white">Prossimo tagliando</p>
                    <button
                      onClick={() => setModal("tagliando")}
                      className="text-xs font-semibold px-3 py-1 rounded-lg"
                      style={{ background: "#29292e", color: "#8e9192" }}
                    >
                      Aggiorna
                    </button>
                  </div>

                  {kmLeft != null ? (
                    <>
                      <p className="font-bold mb-2" style={{ fontSize: 22, color: progressColor }}>
                        {kmLeft.toLocaleString()} km
                      </p>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "#1e1f23" }}>
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: "100%",
                            background: progressColor,
                            borderRadius: 99,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "#8e9192" }}>
                        al raggiungimento di {tagliando!.next_service_km!.toLocaleString()} km
                      </p>
                    </>
                  ) : (
                    <p className="text-xs py-2" style={{ color: "#8e9192" }}>
                      {tagliando ? "Odometro non disponibile" : "Nessun dato — premi Aggiorna per inserire"}
                    </p>
                  )}
                </div>

                <div className="rounded-xl p-3" style={{ background: "#14151a" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-white">Cambio gomme</p>
                    <button
                      onClick={() => setModal("gomme")}
                      className="text-xs font-semibold px-3 py-1 rounded-lg"
                      style={{ background: "#29292e", color: "#8e9192" }}
                    >
                      Registra cambio
                    </button>
                  </div>
                  {gomme ? (
                    <p className="text-sm" style={{ color: "#8e9192" }}>
                      {gommeKmAgo != null && (
                        <span className="font-semibold text-white">{gommeKmAgo.toLocaleString()} km fa</span>
                      )}
                      {gommeDateStr && (
                        <span>{gommeKmAgo != null ? " · " : ""}{gommeDateStr}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs py-1" style={{ color: "#8e9192" }}>
                      Nessun cambio registrato
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* ── Viaggi ── */}
          <Card>
            <SectionTitle icon={Route} color="#3b82f6" title={`Viaggi · ${periodTitle(period)}`} />

            {loadingTrips ? (
              <p className="text-xs py-4 text-center" style={{ color: "#8e9192" }}>Caricamento…</p>
            ) : days.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "#8e9192" }}>
                Nessuna sessione di guida rilevata nel periodo.
              </p>
            ) : (
              days.map((day) => (
                <div key={day.isoDate} className="mb-5 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8e9192" }}>
                      {day.label}
                    </p>
                    {day.totalKm > 0 && (
                      <p className="text-xs font-semibold text-white">
                        {Math.round(day.totalKm).toLocaleString()} km tot.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {day.sessions.map((s, i) => {
                      const sk = s.startCoords ? geoKey(s.startCoords) : null;
                      const ek = s.endCoords   ? geoKey(s.endCoords)   : null;
                      const startAddr = sk ? geoLabels.get(sk) : null;
                      const endAddr   = ek ? geoLabels.get(ek) : null;
                      return (
                        <div key={i} className="rounded-xl p-3" style={{ background: "#14151a" }}>
                          <div className="flex gap-2.5">
                            <div className="flex flex-col items-center shrink-0" style={{ paddingTop: 3 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", border: "2px solid rgba(255,255,255,0.8)", display: "block", flexShrink: 0 }} />
                              <span style={{ width: 2, flex: 1, background: "#374151", display: "block", margin: "3px 0", minHeight: 16 }} />
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444", border: "2px solid rgba(255,255,255,0.8)", display: "block", flexShrink: 0 }} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between" style={{ gap: 10 }}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-white truncate">
                                  {startAddr ?? (s.startCoords ? "…" : "—")}
                                </span>
                                <span className="text-xs shrink-0" style={{ color: "#6b7280" }}>{fmtTime(s.startTime)}</span>
                              </div>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-white truncate">
                                  {endAddr ?? (s.endCoords ? "…" : "—")}
                                </span>
                                <span className="text-xs shrink-0" style={{ color: "#6b7280" }}>{fmtTime(s.endTime)}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end justify-center shrink-0 ml-1" style={{ gap: 2 }}>
                              <span className="text-sm font-bold leading-none text-white">
                                {Math.round(s.km)} km
                              </span>
                              <span className="text-xs" style={{ color: "#6b7280" }}>{fmtDur(s.durationMin)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {/* ── Modals ── */}
      {modal === "tagliando" && (
        <FormModal
          title="Aggiorna tagliando"
          fields={[
            { label: "Km attuali (odometro)", key: "km_at_service",  type: "number", placeholder: "es. 85000" },
            { label: "Prossimo tagliando a km",key: "next_service_km", type: "number", placeholder: "es. 100000" },
            { label: "Data tagliando",          key: "date",           type: "date" },
          ]}
          onClose={() => setModal(null)}
          onSave={(v) => saveMaintenance(v, "tagliando")}
        />
      )}
      {modal === "gomme" && (
        <FormModal
          title="Registra cambio gomme"
          fields={[
            { label: "Km al cambio (odometro)", key: "km_at_service", type: "number", placeholder: "es. 85000" },
            { label: "Data cambio",              key: "date",          type: "date" },
            { label: "Note (opzionale)",         key: "notes",         type: "text", placeholder: "es. Pirelli P Zero" },
          ]}
          onClose={() => setModal(null)}
          onSave={(v) => saveMaintenance(v, "gomme")}
        />
      )}
    </div>
  );
}
