"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  speed: number | null;
  speedMax?: number | null;
  odometer: number | null;
  location?: { latitude: number; longitude: number } | null;
}

interface TripSession {
  startTime: Date;
  endTime: Date;
  km: number | null;
  kmEstimated: boolean;
  durationMin: number;
  startCoords: { latitude: number; longitude: number } | null;
  endCoords:   { latitude: number; longitude: number } | null;
}

interface DayGroup {
  label: string;
  isoDate: string;
  totalKm: number | null;
  sessions: TripSession[];
}

// ─── trip logic ───────────────────────────────────────────────────────────────

// 2h gap = nuova sessione (dati orari: gap normale < 2h)
const GAP_MS = 2 * 60 * 60 * 1000;

// Zero out frozen sensor readings: same non-zero speed for 2+ consecutive hours where avg==max
// (avg==max means only one raw sample that hour — classic stale/disconnected sensor behaviour)
function defrost(signals: Signal[]): Signal[] {
  const out = signals.map(s => ({ ...s }));
  let i = 0;
  while (i < out.length) {
    const spd = out[i].speed ?? 0;
    if (spd <= 0) { i++; continue; }
    // find consecutive run where value is identical AND avg==max (or no max available)
    let j = i;
    while (
      j < out.length &&
      (out[j].speed ?? 0) === spd &&
      (out[j].speedMax == null || out[j].speedMax === spd)
    ) j++;
    if (j - i >= 2) {
      for (let k = i; k < j; k++) out[k].speed = 0;
    }
    i = j > i ? j : i + 1;
  }
  return out;
}

function buildSessions(signals: Signal[]): TripSession[] {
  if (!signals.length) return [];
  const sorted = defrost(
    [...signals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  );
  const sessions: TripSession[] = [];
  let start = 0;

  for (let i = 1; i <= sorted.length; i++) {
    const isLast = i === sorted.length;

    // nuova sessione se gap > 2h
    const gapBreak =
      !isLast &&
      new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime() > GAP_MS;

    // oppure se gli ultimi 3 punti consecutivi sono tutti a speed = 0
    const trailingZeros =
      !isLast &&
      i >= 3 &&
      [sorted[i - 3], sorted[i - 2], sorted[i - 1]].every((s) => (s.speed ?? 0) === 0);

    if (isLast || gapBreak || trailingZeros) {
      const chunk = sorted.slice(start, i);
      const hasMovement = chunk.some((s) => (s.speed ?? 0) > 0);

      if (hasMovement) {
        const t0 = new Date(chunk[0].timestamp);
        const t1 = new Date(chunk[chunk.length - 1].timestamp);
        const dur = Math.round((t1.getTime() - t0.getTime()) / 60_000);

        // km = delta odometro (primo → ultimo non-null nella sessione)
        // Richiede entrambi i valori; scarta se > 500 km (dato anomalo)
        let km: number | null = null;
        let kmEstimated = false;
        const firstOdo = chunk.find(s => s.odometer != null)?.odometer ?? null;
        const lastOdo  = [...chunk].reverse().find(s => s.odometer != null)?.odometer ?? null;
        if (firstOdo != null && lastOdo != null) {
          const delta = lastOdo - firstOdo;
          if (delta > 0 && delta <= 500) km = Math.round(delta);
          // delta <= 0: sensore non avanzato → fallback
          // delta > 500: anomalia → fallback
        }

        // fallback: integrazione trapezioidale velocità × tempo
        if (km == null) {
          let kmEst = 0;
          for (let j = 1; j < chunk.length; j++) {
            const v0 = chunk[j - 1].speed ?? 0;
            const v1 = chunk[j].speed ?? 0;
            const dtMin = (new Date(chunk[j].timestamp).getTime() - new Date(chunk[j - 1].timestamp).getTime()) / 60_000;
            kmEst += ((v0 + v1) / 2) * (dtMin / 60);
          }
          if (kmEst > 0) { km = Math.round(kmEst); kmEstimated = true; }
        }

        const startCoords = chunk.find(s => s.location?.latitude != null)?.location ?? null;
        const endCoords   = [...chunk].reverse().find(s => s.location?.latitude != null)?.location ?? null;

        if (dur > 5) sessions.push({ startTime: t0, endTime: t1, km, kmEstimated, durationMin: dur, startCoords, endCoords });
      }
      start = i;
    }
  }
  return sessions;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { "Accept-Language": "it", "User-Agent": "MyMine-Fleet/1.0" } }
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
    if (!map.has(iso)) map.set(iso, { label, isoDate: iso, totalKm: null, sessions: [] });
    const g = map.get(iso)!;
    g.sessions.push(s);
    if (s.km != null) g.totalKm = (g.totalKm ?? 0) + s.km;
  }
  return Array.from(map.values());
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
  const [vehicles, setVehicles]       = useState<VehicleItem[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [showVehicles, setShowVehicles] = useState(false);

  const [adBlue, setAdBlue]           = useState<number | null>(null);
  const [odometer, setOdometer]       = useState<number | null>(null);

  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [sessions, setSessions]       = useState<TripSession[]>([]);

  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const [modal, setModal]             = useState<ModalType>(null);
  const [geoLabels, setGeoLabels]     = useState<Map<string, string>>(new Map());
  const geocodeCacheRef               = useRef(new Map<string, string>());

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

  // ── load data when vehicle changes ──
  const loadData = useCallback(async (tokenId: number) => {
    setAdBlue(null); setOdometer(null); setMaintenance([]); setSessions([]); setGeoLabels(new Map());
    setLoadingMain(true); setLoadingTrips(true);

    // latest (adBlue + odometer)
    fetch(`/api/latest?tokenId=${tokenId}`)
      .then((r) => r.json())
      .then((d) => {
        setAdBlue(d.powertrainCombustionEngineDieselExhaustFluidLevel ?? null);
        setOdometer(d.powertrainTransmissionTravelledDistance ?? null);
      })
      .catch(() => {})
      .finally(() => {});

    // maintenance
    fetch(`/api/maintenance?tokenId=${tokenId}`)
      .then((r) => r.json())
      .then((d: MaintenanceRecord[]) => Array.isArray(d) ? setMaintenance(d) : null)
      .catch(() => {})
      .finally(() => setLoadingMain(false));

    // telemetry 7d for trips
    const from = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
    const to   = new Date().toISOString();
    fetch(`/api/telemetry?tokenId=${tokenId}&hours=168&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d: Signal[]) => Array.isArray(d) ? setSessions(buildSessions(d)) : null)
      .catch(() => {})
      .finally(() => setLoadingTrips(false));
  }, []);

  useEffect(() => {
    if (selectedId != null) loadData(selectedId);
  }, [selectedId, loadData]);

  // ── geocode start/end coords for each session ──
  useEffect(() => {
    if (!sessions.length) return;
    // Collect unique coords not yet in cache
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
        if (i > 0) await new Promise(r => setTimeout(r, 1200)); // Nominatim: max 1 req/s
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
    if (selectedId) loadData(selectedId);
  }

  // ── render ──
  return (
    <div className="px-4 pt-6 pb-8" style={{ minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="mb-5">
        <p className="font-bold text-white" style={{ fontSize: 16, lineHeight: 1 }}>MyMine</p>
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>
      <h1 className="font-bold text-white mb-4" style={{ fontSize: 28 }}>Analytics</h1>

      {/* ── Vehicle picker ── */}
      {vehicles.length > 0 && (
        <div className="relative mb-5">
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
          {/* ── Stats row ── */}
          {!loadingTrips && (() => {
            const totalKm   = sessions.reduce((s, t) => s + (t.km ?? 0), 0);
            const activeDays = days.filter(d => d.totalKm != null && d.totalKm > 0).length;
            const avgKmDay  = activeDays > 0 ? Math.round(totalKm / activeDays) : 0;
            return (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Km (7gg)", value: Math.round(totalKm).toLocaleString(), color: "#3b82f6" },
                  { label: "Sessioni", value: sessions.length,                       color: "#8b5cf6" },
                  { label: "Km/giorno", value: avgKmDay.toLocaleString(),            color: "#4ade80" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center rounded-2xl py-3" style={{ background: "#1e1f23" }}>
                    <span className="font-bold leading-none" style={{ fontSize: 20, color }}>{value}</span>
                    <span className="font-semibold tracking-wider uppercase mt-1" style={{ fontSize: 9, color: "#8e9192" }}>{label}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Km giornalieri bar chart ── */}
          {!loadingTrips && days.length > 0 && (() => {
            const maxKm = Math.max(...days.map(d => d.totalKm ?? 0), 1);
            return (
              <Card style={{ marginBottom: 12 }}>
                <SectionTitle icon={BarChart2} color="#3b82f6" title="Km giornalieri (7gg)" />
                <div className="flex items-end gap-1.5" style={{ height: 80 }}>
                  {days.slice().reverse().map((d) => {
                    const km  = d.totalKm ?? 0;
                    const pct = Math.max(4, Math.round((km / maxKm) * 100));
                    return (
                      <div key={d.isoDate} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                        <div
                          style={{
                            width: "100%", height: `${pct}%`,
                            background: km > 0 ? "#3b82f6" : "#2a2b30",
                            borderRadius: "4px 4px 2px 2px",
                            minHeight: 4,
                          }}
                        />
                        <span style={{ fontSize: 8, color: "#8e9192", textAlign: "center" }}>
                          {new Date(d.isoDate).toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

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
                {/* Prossimo tagliando */}
                <div
                  className="rounded-xl p-3 mb-3"
                  style={{ background: "#14151a" }}
                >
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

                {/* Cambio gomme */}
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
            <SectionTitle icon={Route} color="#3b82f6" title="Viaggi ultimi 7 giorni" />

            {loadingTrips ? (
              <p className="text-xs py-4 text-center" style={{ color: "#8e9192" }}>Caricamento…</p>
            ) : days.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "#8e9192" }}>
                Nessuna sessione di guida rilevata nel periodo.
              </p>
            ) : (
              days.map((day) => (
                <div key={day.isoDate} className="mb-5 last:mb-0">
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8e9192" }}>
                      {day.label}
                    </p>
                    {day.totalKm != null && (
                      <p className="text-xs font-semibold text-white">
                        {Math.round(day.totalKm).toLocaleString()} km tot.
                      </p>
                    )}
                  </div>

                  {/* Sessions */}
                  <div className="flex flex-col gap-2">
                    {day.sessions.map((s, i) => {
                      const sk = s.startCoords ? geoKey(s.startCoords) : null;
                      const ek = s.endCoords   ? geoKey(s.endCoords)   : null;
                      const startAddr = sk ? geoLabels.get(sk) : null;
                      const endAddr   = ek ? geoLabels.get(ek) : null;
                      return (
                        <div key={i} className="rounded-xl p-3" style={{ background: "#14151a" }}>
                          <div className="flex gap-2.5">
                            {/* Timeline */}
                            <div className="flex flex-col items-center shrink-0" style={{ paddingTop: 3 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", border: "2px solid rgba(255,255,255,0.8)", display: "block", flexShrink: 0 }} />
                              <span style={{ width: 2, flex: 1, background: "#374151", display: "block", margin: "3px 0", minHeight: 16 }} />
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444", border: "2px solid rgba(255,255,255,0.8)", display: "block", flexShrink: 0 }} />
                            </div>
                            {/* Addresses + times */}
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
                            {/* Stats */}
                            <div className="flex flex-col items-end justify-center shrink-0 ml-1" style={{ gap: 2 }}>
                              {s.km != null && (
                                <span
                                  className="text-sm font-bold leading-none"
                                  style={{ color: s.kmEstimated ? "#8e9192" : "#ffffff" }}
                                  title={s.kmEstimated ? "Stima da velocità (odometro non disponibile)" : undefined}
                                >
                                  {s.kmEstimated ? "~" : ""}{Math.round(s.km)} km
                                </span>
                              )}
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
