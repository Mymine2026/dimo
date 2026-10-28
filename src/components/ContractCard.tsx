"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, FileText } from "lucide-react";
import type { KmStatus, Risk } from "@/lib/contracts";

interface Contract {
  lessor: string | null; contract_number: string | null; delivery_date: string | null; months: number | null;
  km_annual: number | null; km_total: number | null; km_increase_requested: number | null; end_date: string | null;
  extra_km_cost: number | null; km_total_extended: number | null; end_date_extended: string | null;
  extension_note: string | null; odometer_start: number | null; odometer_start_source: string | null;
}
interface Resp { contract: Contract | null; status: KmStatus | null; odometer: { km: number | null; at: string } | null }

const RISK: Record<Risk, { label: string; color: string; bg: string }> = {
  critico: { label: "Oltre i km inclusi", color: "#f87171", bg: "rgba(239,68,68,0.14)" },
  attenzione: { label: "Vicino al limite", color: "#facc15", bg: "rgba(250,204,21,0.14)" },
  ok: { label: "In regola", color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  nd: { label: "Dati incompleti", color: "#9ca3af", bg: "rgba(156,163,175,0.14)" },
};
const BAR: Record<Risk, string> = { critico: "#e24b4a", attenzione: "#eda100", ok: "#1baf7a", nd: "#6b7280" };

const km = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("it-IT"));
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("it-IT") : "—");
const month = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("it-IT", { month: "2-digit", year: "numeric" }) : "—");

const EMPTY: Record<string, string> = {
  lessor: "", contract_number: "", delivery_date: "", months: "", km_annual: "", km_total: "", km_increase_requested: "",
  end_date: "", extra_km_cost: "", km_total_extended: "", end_date_extended: "", extension_note: "", odometer_start: "",
};
const FIELDS: { key: string; label: string; type?: "date" | "text"; wide?: boolean }[] = [
  { key: "lessor", label: "Noleggiatore" }, { key: "contract_number", label: "N. contratto" },
  { key: "delivery_date", label: "Consegna", type: "date" }, { key: "months", label: "Durata (mesi)" },
  { key: "km_total", label: "Km totali inclusi" }, { key: "km_annual", label: "Km annui" },
  { key: "odometer_start", label: "Km alla consegna" }, { key: "extra_km_cost", label: "Costo extra km (€)" },
  { key: "end_date", label: "Scadenza (se diversa)", type: "date" }, { key: "km_increase_requested", label: "Aumento km richiesto" },
  { key: "km_total_extended", label: "Km totali dopo proroga" }, { key: "end_date_extended", label: "Scadenza dopo proroga", type: "date" },
  { key: "extension_note", label: "Note sulla proroga", wide: true },
];

export default function ContractCard({ tokenId }: { tokenId: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [denied, setDenied] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/vehicles/contract?tokenId=${tokenId}`);
      if (r.status === 403 || r.status === 401) { setDenied(true); return; }
      const d: Resp = await r.json();
      setData(d);
      const c = d.contract;
      setForm(c ? Object.fromEntries(Object.keys(EMPTY).map(k => [k, String((c as unknown as Record<string, unknown>)[k] ?? "")])) : EMPTY);
    } catch { /* la scheda non è essenziale */ }
  }, [tokenId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/vehicles/contract", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: Number(tokenId), fields: form }),
      });
      const d = await r.json().catch(() => ({ error: `Errore del server (${r.status}): riprova tra un minuto` }));
      if (!r.ok) throw new Error(d.error ?? "Errore");
      setEdit(false);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (denied || !data) return null;
  const { contract: c, status: s, odometer } = data;
  const risk = s?.risk ?? "nd";
  const R = RISK[risk];
  const cap = (n: number | null) => (n == null ? 0 : Math.max(0, Math.min(100, n)));

  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <FileText className="w-4 h-4" style={{ color: "#8e9192" }} />
        <span className="font-semibold text-white flex-1" style={{ fontSize: 14 }}>Contratto di noleggio e km</span>
        {c && s && <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 8, background: R.bg, color: R.color }}>{R.label}</span>}
        <button type="button" onClick={() => setEdit(e => !e)} className="flex items-center gap-1 font-semibold" style={{ fontSize: 12, color: "#fff" }}>
          <Pencil className="w-3.5 h-3.5" /> {c ? "Modifica" : "Inserisci"}
        </button>
      </div>

      {msg && <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 8 }}>{msg}</p>}

      {edit ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {FIELDS.map(f => (
              <label key={f.key} style={{ gridColumn: f.wide ? "1 / -1" : undefined }}>
                <span className="font-semibold uppercase tracking-widest" style={{ fontSize: 9, color: "#8e9192" }}>{f.label}</span>
                <input value={form[f.key] ?? ""} type={f.type === "date" ? "date" : "text"} inputMode={f.type ? undefined : "decimal"}
                  onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  className="w-full text-white text-sm outline-none" style={{ background: "#292a2e", borderRadius: 10, padding: "8px 10px", marginTop: 3 }} />
              </label>
            ))}
          </div>
          <div className="flex gap-3" style={{ marginTop: 14 }}>
            <button type="button" disabled={busy} onClick={() => { setEdit(false); void load(); }} className="flex-1 font-bold" style={{ background: "#292a2e", color: "#fff", borderRadius: 12, padding: 11, fontSize: 13 }}>Annulla</button>
            <button type="button" disabled={busy} onClick={save} className="flex-1 flex items-center justify-center gap-2 font-bold disabled:opacity-50" style={{ background: "#fff", color: "#000", borderRadius: 12, padding: 11, fontSize: 13 }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
            </button>
          </div>
        </>
      ) : !c ? (
        <p style={{ fontSize: 13, color: "#8e9192" }}>Nessun contratto inserito. Con i km inclusi, la data di consegna e i km alla consegna l&apos;app calcola l&apos;avanzamento dal contachilometri del sensore.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-white font-semibold" style={{ fontSize: 28 }}>{s?.used != null ? km(s.used) : "—"}</span>
            <span style={{ fontSize: 13, color: "#8e9192" }}>su {km(s?.limit)} km inclusi</span>
          </div>
          <div style={{ position: "relative", height: 10, background: "#16171a", borderRadius: 5, margin: "8px 0 4px", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${cap(s?.usedPct ?? 0)}%`, background: BAR[risk], borderRadius: 5 }} />
            {s?.timePct != null && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${cap(s.timePct)}%`, width: 2, background: "#fff" }} />}
          </div>
          <div className="flex justify-between" style={{ fontSize: 11, color: "#8e9192" }}>
            <span>{s?.usedPct != null ? `${Math.round(s.usedPct)}% dei km usati` : "km usati non calcolabili"}</span>
            <span>{s?.timePct != null ? `${Math.round(s.timePct)}% del tempo trascorso (linea bianca)` : ""}</span>
          </div>

          {s && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 12 }}>
              {[
                ["Previsti alla scadenza", s.projected != null ? km(s.projected) : "—", "#fff"],
                ["Oltre i km inclusi", s.overrun != null ? (s.overrun > 0 ? "+" + km(s.overrun) : "nessuno") : "—", s.overrun && s.overrun > 0 ? "#f87171" : "#fff"],
                ["Costo extra stimato", s.overrunCost != null ? `${km(s.overrunCost)} €` : "—", "#fff"],
                ["Limite raggiunto il", s.limitDate ? month(s.limitDate) : "—", "#fff"],
                ["Scadenza", day(s.endDate), "#fff"],
                ["Ritmo", s.ratePerDay != null ? `${km(s.ratePerDay * 30)} km/mese` : "—", "#fff"],
              ].map(([l, v, col]) => (
                <div key={l} style={{ background: "#292a2e", borderRadius: 10, padding: "8px 10px" }}>
                  <p style={{ fontSize: 10, color: "#8e9192" }}>{l}</p>
                  <p className="font-semibold" style={{ fontSize: 15, color: col }}>{v}</p>
                </div>
              ))}
            </div>
          )}

          {s && s.missing.length > 0 && (
            <p style={{ fontSize: 12, color: "#facc15", marginTop: 10 }}>Per il calcolo mancano: {s.missing.join(", ")}.</p>
          )}
          <p style={{ fontSize: 11, color: "#8e9192", marginTop: 10 }}>
            {[c.lessor, c.contract_number, odometer?.km != null ? `contachilometri del sensore ${km(odometer.km)} km (${day(odometer.at)})` : null,
              s?.rateBasis === "recente" ? "ritmo degli ultimi giorni" : s?.rateBasis === "contratto" ? "ritmo medio dalla consegna" : null]
              .filter(Boolean).join(" · ")}
          </p>
        </>
      )}
    </div>
  );
}
