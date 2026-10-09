"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Pencil, Plus, Trash2, Wrench, Users, X } from "lucide-react";
import type { MaintenancePlan, PlanDue } from "@/lib/maintenance-plans";

// ─── types ───────────────────────────────────────────────────────────────────

type PlanView = MaintenancePlan & { due: PlanDue };

interface PlanVehicle {
  id: number;
  token_id: number;
  name: string;
  plate: string | null;
  company_id: number | null;
  odometer_km: number | null;
  plans: PlanView[];
}

interface Assignment {
  id: number;
  vehicle_id: number;
  user_id: number;
  email: string;
  start_at: string;
  end_at: string | null;
}

interface DriverVehicle {
  id: number;
  token_id: number;
  name: string;
  plate: string | null;
  company_id: number | null;
  current: Assignment | null;
  history: Assignment[];
}

interface Driver { id: number; email: string; company_id: number | null }

interface UsageRow {
  vehicle_id: number;
  vehicle_name: string;
  plate: string | null;
  user_id: number | null;
  email: string | null;
  km: number;
  days: number;
  off_hours_km: number;
  avg_speed: number | null;
}

type Tab = "scadenze" | "autisti";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtKm = (n: number) => Math.round(n).toLocaleString("it-IT");
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
const todayIso = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  overdue: { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "SCADUTA", rank: 0 },
  soon:    { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "IN SCADENZA", rank: 1 },
  unknown: { bg: "rgba(107,114,128,0.15)", color: "#9ca3af", label: "DA IMPOSTARE", rank: 2 },
  ok:      { bg: "rgba(74,222,128,0.12)", color: "#4ade80", label: "OK", rank: 3 },
} as const;

function describeDue(due: PlanDue): string {
  if (due.status === "unknown") return "Imposta data/km dell'ultimo intervento";
  const parts: string[] = [];
  if (due.status === "overdue") {
    if (due.kmLeft != null && due.kmLeft <= 0) parts.push(`da ${fmtKm(-due.kmLeft)} km`);
    if (due.daysLeft != null && due.daysLeft < 0) parts.push(`da ${-due.daysLeft} giorni`);
    return parts.join(" · ");
  }
  if (due.kmLeft != null) parts.push(`tra ${fmtKm(due.kmLeft)} km`);
  if (due.dueDate && due.daysLeft != null) parts.push(`entro ${fmtDay(due.dueDate)} (${due.daysLeft} gg)`);
  return parts.join(" · ");
}

function worstRank(v: PlanVehicle): number {
  return v.plans.length ? Math.min(...v.plans.map((p) => STATUS_STYLE[p.due.status].rank)) : 4;
}

// ─── shared UI ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, onSubmit, loading, submitLabel, children }: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void;
  loading: boolean; submitLabel: string; children: React.ReactNode;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.85)", overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit}
        style={{ position: "relative", margin: "20px auto 80px", maxWidth: 520, background: "#1e1f23", borderRadius: 16, padding: 24 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 className="font-bold text-white" style={{ fontSize: 18 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ color: "#8e9192" }}><X className="w-5 h-5" /></button>
        </div>
        {children}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button type="button" onClick={onClose} className="flex-1 font-bold"
            style={{ background: "#292a2e", color: "#fff", borderRadius: 14, padding: 13, fontSize: 14 }}>Annulla</button>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 font-bold disabled:opacity-50"
            style={{ background: "#fff", color: "#000", borderRadius: 14, padding: 13, fontSize: 14 }}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{submitLabel}…</> : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: "#8e9192" }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: "#6b7280" }}>{hint}</span>}
    </div>
  );
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", caretColor: "#fff", ...props.style }} />
  );
}

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl p-3 mb-3"
      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
      <span className="text-sm" style={{ color: "#fca5a5" }}>{msg}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-10 rounded-2xl" style={{ background: "#1e1f23" }}>
      <p style={{ fontSize: 13, color: "#8e9192" }}>{label}</p>
    </div>
  );
}

async function postJson(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? `Errore ${res.status}`;
}

// ─── scadenze ────────────────────────────────────────────────────────────────

const SUGGESTIONS = ["Tagliando", "Gomme", "Revisione", "Assicurazione", "Bollo", "Freni", "Cinghia distribuzione", "Batteria"];

interface PlanForm { name: string; interval_km: string; interval_months: string; last_done_km: string; last_done_date: string; notes: string }

function ScadenzeTab({ vehicles, canEdit, onChanged }: { vehicles: PlanVehicle[]; canEdit: boolean; onChanged: () => void }) {
  const [planModal, setPlanModal] = useState<{ vehicle: PlanVehicle; plan: PlanView | null } | null>(null);
  const [doneModal, setDoneModal] = useState<{ vehicle: PlanVehicle; plan: PlanView } | null>(null);
  const [form, setForm] = useState<PlanForm>({ name: "", interval_km: "", interval_months: "", last_done_km: "", last_done_date: "", notes: "" });
  const [done, setDone] = useState({ date: todayIso(), km: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const all = vehicles.flatMap((v) => v.plans);
  const counts = {
    overdue: all.filter((p) => p.due.status === "overdue").length,
    soon: all.filter((p) => p.due.status === "soon").length,
    ok: all.filter((p) => p.due.status === "ok").length,
  };
  const sorted = [...vehicles].sort((a, b) => worstRank(a) - worstRank(b) || a.name.localeCompare(b.name));

  function openPlan(vehicle: PlanVehicle, plan: PlanView | null) {
    setErr(null);
    setForm(plan
      ? {
          name: plan.name,
          interval_km: plan.interval_km?.toString() ?? "",
          interval_months: plan.interval_months?.toString() ?? "",
          last_done_km: plan.last_done_km?.toString() ?? "",
          last_done_date: plan.last_done_date ?? "",
          notes: plan.notes ?? "",
        }
      : {
          name: "", interval_km: "", interval_months: "",
          last_done_km: vehicle.odometer_km != null ? String(Math.round(vehicle.odometer_km)) : "",
          last_done_date: todayIso(), notes: "",
        });
    setPlanModal({ vehicle, plan });
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planModal) return;
    setSaving(true); setErr(null);
    const error = await postJson("/api/maintenance-plans", planModal.plan ? "PUT" : "POST", {
      ...form, id: planModal.plan?.id, vehicle_id: planModal.vehicle.id,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setPlanModal(null);
    onChanged();
  }

  async function removePlan(plan: PlanView) {
    if (!confirm(`Eliminare la scadenza "${plan.name}"?`)) return;
    const res = await fetch(`/api/maintenance-plans?id=${plan.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  function openDone(vehicle: PlanVehicle, plan: PlanView) {
    setErr(null);
    setDone({ date: todayIso(), km: vehicle.odometer_km != null ? String(Math.round(vehicle.odometer_km)) : "", notes: "" });
    setDoneModal({ vehicle, plan });
  }

  async function saveDone(e: React.FormEvent) {
    e.preventDefault();
    if (!doneModal) return;
    setSaving(true); setErr(null);
    const error = await postJson("/api/maintenance-plans/complete", "POST", {
      id: doneModal.plan.id, done_date: done.date, done_km: done.km, notes: done.notes,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setDoneModal(null);
    onChanged();
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {([["overdue", "Scadute"], ["soon", "In scadenza"], ["ok", "In regola"]] as const).map(([k, label]) => (
          <div key={k} style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
            <p className="font-bold" style={{ fontSize: 22, color: STATUS_STYLE[k].color }}>{counts[k]}</p>
            <p style={{ fontSize: 11, color: "#8e9192" }}>{label}</p>
          </div>
        ))}
      </div>

      {sorted.length === 0 && <Empty label="Nessun veicolo disponibile" />}

      {sorted.map((v) => (
        <div key={v.id} className="mb-3" style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="font-semibold text-white truncate" style={{ fontSize: 15 }}>{v.name}{v.plate ? ` · ${v.plate}` : ""}</p>
              <p style={{ fontSize: 11, color: "#8e9192" }}>
                {v.odometer_km != null ? `${fmtKm(v.odometer_km)} km` : "Odometro non disponibile"}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => openPlan(v, null)} className="flex items-center gap-1 font-semibold shrink-0"
                style={{ background: "#292a2e", color: "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 12 }}>
                <Plus className="w-3.5 h-3.5" />Scadenza
              </button>
            )}
          </div>

          {v.plans.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Nessuna scadenza programmata</p>}

          {[...v.plans].sort((a, b) => STATUS_STYLE[a.due.status].rank - STATUS_STYLE[b.due.status].rank).map((p) => {
            const s = STATUS_STYLE[p.due.status];
            return (
              <div key={p.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-white truncate" style={{ fontSize: 14 }}>{p.name}</p>
                    <span className="font-bold shrink-0" style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color, letterSpacing: "0.08em" }}>
                      {s.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: s.color }}>{describeDue(p.due)}</p>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>
                    Ogni {[p.interval_km ? `${fmtKm(p.interval_km)} km` : null, p.interval_months ? `${p.interval_months} mesi` : null].filter(Boolean).join(" / ")}
                    {p.last_done_date ? ` · ultimo ${fmtDay(p.last_done_date)}` : ""}
                    {p.last_done_km != null ? ` a ${fmtKm(p.last_done_km)} km` : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => openDone(v, p)} title="Segna come eseguita" className="p-1.5 rounded-lg" style={{ color: "#4ade80" }}><Check className="w-4 h-4" /></button>
                    <button onClick={() => openPlan(v, p)} title="Modifica" className="p-1.5 rounded-lg" style={{ color: "#8e9192" }}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => removePlan(p)} title="Elimina" className="p-1.5 rounded-lg" style={{ color: "#f87171" }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {planModal && (
        <Modal title={planModal.plan ? "Modifica scadenza" : `Nuova scadenza · ${planModal.vehicle.name}`}
          onClose={() => setPlanModal(null)} onSubmit={savePlan} loading={saving} submitLabel="Salva">
          {err && <ErrBanner msg={err} />}
          <Field label="Nome">
            <FInput list="plan-names" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es. Tagliando" required />
            <datalist id="plan-names">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ogni (km)"><FInput type="number" min={0} value={form.interval_km} onChange={(e) => setForm({ ...form, interval_km: e.target.value })} placeholder="15000" /></Field>
            <Field label="Ogni (mesi)"><FInput type="number" min={0} value={form.interval_months} onChange={(e) => setForm({ ...form, interval_months: e.target.value })} placeholder="12" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ultimo intervento (km)" hint="Se non lo conosci lascia i km attuali: la scadenza parte da oggi">
              <FInput type="number" min={0} value={form.last_done_km} onChange={(e) => setForm({ ...form, last_done_km: e.target.value })} />
            </Field>
            <Field label="Ultimo intervento (data)">
              <FInput type="date" value={form.last_done_date} onChange={(e) => setForm({ ...form, last_done_date: e.target.value })} />
            </Field>
          </div>
          <Field label="Note"><FInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </Modal>
      )}

      {doneModal && (
        <Modal title={`Eseguita · ${doneModal.plan.name}`} onClose={() => setDoneModal(null)} onSubmit={saveDone} loading={saving} submitLabel="Conferma">
          {err && <ErrBanner msg={err} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><FInput type="date" value={done.date} onChange={(e) => setDone({ ...done, date: e.target.value })} required /></Field>
            <Field label="Km"><FInput type="number" min={0} value={done.km} onChange={(e) => setDone({ ...done, km: e.target.value })} /></Field>
          </div>
          <Field label="Note"><FInput value={done.notes} onChange={(e) => setDone({ ...done, notes: e.target.value })} /></Field>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>La prossima scadenza viene ricalcolata da questi valori.</p>
        </Modal>
      )}
    </>
  );
}

// ─── autisti ─────────────────────────────────────────────────────────────────

function AutistiTab({ vehicles, drivers, usage, days, onDays, onChanged }: {
  vehicles: DriverVehicle[]; drivers: Driver[]; usage: UsageRow[]; days: number;
  onDays: (d: number) => void; onChanged: () => void;
}) {
  const [pick, setPick] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function apply(v: DriverVehicle) {
    const value = pick[v.id];
    if (value === undefined) return;
    setBusy(v.id); setErr(null);
    const error = await postJson("/api/drivers/assign", "POST", { vehicle_id: v.id, user_id: value === "" ? null : Number(value) });
    setBusy(null);
    if (error) { setErr(error); return; }
    setPick((p) => { const n = { ...p }; delete n[v.id]; return n; });
    onChanged();
  }

  return (
    <>
      {err && <ErrBanner msg={err} />}
      <p className="font-semibold uppercase tracking-widest mb-2" style={{ fontSize: 10, color: "#8e9192" }}>Assegnazioni</p>
      {vehicles.length === 0 && <Empty label="Nessun veicolo disponibile" />}
      {vehicles.map((v) => {
        const options = drivers.filter((d) => d.company_id === v.company_id);
        const selected = pick[v.id] ?? (v.current ? String(v.current.user_id) : "");
        const changed = pick[v.id] !== undefined && pick[v.id] !== (v.current ? String(v.current.user_id) : "");
        return (
          <div key={v.id} className="mb-3" style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
            <p className="font-semibold text-white" style={{ fontSize: 15 }}>{v.name}{v.plate ? ` · ${v.plate}` : ""}</p>
            <p className="mb-3" style={{ fontSize: 12, color: "#8e9192" }}>
              {v.current ? `${v.current.email} dal ${fmtDay(v.current.start_at)}` : "Nessun autista assegnato"}
            </p>
            <div className="flex gap-2">
              <select value={selected} onChange={(e) => setPick({ ...pick, [v.id]: e.target.value })}
                className="flex-1 text-white text-sm outline-none min-w-0"
                style={{ background: "#292a2e", borderRadius: 12, padding: "10px 12px" }}>
                <option value="">— nessun autista —</option>
                {options.map((d) => <option key={d.id} value={d.id}>{d.email}</option>)}
              </select>
              <button onClick={() => apply(v)} disabled={!changed || busy === v.id}
                className="font-bold disabled:opacity-40 shrink-0"
                style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "0 16px", fontSize: 13 }}>
                {busy === v.id ? "…" : "Applica"}
              </button>
            </div>
            {options.length === 0 && (
              <p className="mt-2" style={{ fontSize: 11, color: "#6b7280" }}>
                Nessun autista in questa azienda: crea un utente con ruolo user dal Pannello Admin.
              </p>
            )}
            {v.history.length > 0 && (
              <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                {v.history.map((a) => (
                  <p key={a.id} style={{ fontSize: 11, color: "#6b7280" }}>
                    {a.email} · {fmtDay(a.start_at)} → {a.end_at ? fmtDay(a.end_at) : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between mt-6 mb-2">
        <p className="font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: "#8e9192" }}>Utilizzo</p>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => onDays(d)} className="font-semibold"
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: days === d ? "#fff" : "#292a2e", color: days === d ? "#000" : "#8e9192" }}>
              {d} gg
            </button>
          ))}
        </div>
      </div>
      {usage.length === 0 && <Empty label="Nessun chilometro registrato nel periodo" />}
      {usage.map((r) => (
        <div key={`${r.vehicle_id}-${r.user_id ?? 0}`} className="mb-2" style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold text-white truncate" style={{ fontSize: 14 }}>{r.email ?? "Non assegnato"}</p>
            <p className="font-bold text-white shrink-0" style={{ fontSize: 16 }}>{fmtKm(r.km)} km</p>
          </div>
          <p style={{ fontSize: 11, color: "#8e9192" }}>
            {r.vehicle_name}{r.plate ? ` · ${r.plate}` : ""} · {r.days} giorni di utilizzo
            {r.avg_speed != null ? ` · vel. media in marcia ${r.avg_speed} km/h` : ""}
          </p>
          {r.off_hours_km > 0 && (
            <p style={{ fontSize: 11, color: "#fbbf24" }}>{fmtKm(r.off_hours_km)} km fuori orario (21–06 o domenica)</p>
          )}
        </div>
      ))}
      <p className="mt-2" style={{ fontSize: 11, color: "#6b7280" }}>
        Chilometri ricavati dall&apos;odometro e attribuiti all&apos;autista assegnato in quel momento. Il rilevamento di frenate e accelerazioni brusche richiede la ricezione diretta dai dispositivi.
      </p>
    </>
  );
}

// ─── pagina ──────────────────────────────────────────────────────────────────

export default function GestionePage() {
  const [tab, setTab] = useState<Tab>("scadenze");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [canEdit, setCanEdit] = useState(false);
  const [planVehicles, setPlanVehicles] = useState<PlanVehicle[]>([]);
  const [driverVehicles, setDriverVehicles] = useState<DriverVehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [days, setDays] = useState(30);

  async function loadPlans() {
    try {
      const res = await fetch("/api/maintenance-plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore nel caricamento");
      setPlanVehicles(data.vehicles);
      setCanEdit(data.canEdit);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }

  async function loadDrivers() {
    const res = await fetch("/api/drivers");
    if (!res.ok) return;
    const data = await res.json();
    setDriverVehicles(data.vehicles);
    setDrivers(data.drivers);
  }

  async function loadUsage(d: number) {
    const res = await fetch(`/api/drivers/usage?days=${d}`);
    if (!res.ok) return;
    const data = await res.json();
    setUsage(data.rows);
  }

  useEffect(() => {
    void loadPlans();
    void loadDrivers();
    void loadUsage(30);
  }, []);

  function changeDays(d: number) {
    setDays(d);
    void loadUsage(d);
  }

  function refreshDrivers() {
    void loadDrivers();
    void loadUsage(days);
  }

  return (
    <div className="px-4 pt-6" style={{ minHeight: "100vh" }}>
      <div className="mb-5">
        <img src="/conexo-logo.png" alt="Conexo Technologies" style={{ height: 32 }} />
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>
      <h1 className="font-bold text-white mb-4" style={{ fontSize: 28 }}>Gestione</h1>

      {canEdit && (
        <div className="flex gap-2 mb-4">
          {([["scadenze", "Scadenze", Wrench], ["autisti", "Autisti", Users]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className="flex items-center gap-2 font-semibold"
              style={{ fontSize: 13, padding: "9px 16px", borderRadius: 999, background: tab === k ? "#fff" : "#1e1f23", color: tab === k ? "#000" : "#8e9192" }}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      )}

      {error && <ErrBanner msg={error} />}
      {loading && (
        <div className="flex items-center gap-3 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} />
        </div>
      )}

      {!loading && !error && tab === "scadenze" && (
        <ScadenzeTab vehicles={planVehicles} canEdit={canEdit} onChanged={() => void loadPlans()} />
      )}
      {!loading && !error && tab === "autisti" && canEdit && (
        <AutistiTab vehicles={driverVehicles} drivers={drivers} usage={usage} days={days} onDays={changeDays} onChanged={refreshDrivers} />
      )}
    </div>
  );
}
