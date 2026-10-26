"use client";

import { useRef, useState } from "react";
import { X, Loader2, FileUp, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { EMPTY_FIELDS, estimateNextInspection, type LibrettoFields } from "@/lib/libretto";

export interface FieldDef {
  key: keyof LibrettoFields;
  label: string;
  type?: "text" | "date" | "number";
  wide?: boolean;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: "plate", label: "Targa" },
  { key: "vin", label: "Telaio (VIN)" },
  { key: "make", label: "Marca" },
  { key: "model", label: "Modello" },
  { key: "type_approval", label: "Tipo / variante / versione" },
  { key: "category", label: "Categoria" },
  { key: "fuel", label: "Alimentazione" },
  { key: "displacement_cc", label: "Cilindrata (cm³)", type: "number" },
  { key: "power_kw", label: "Potenza (kW)", type: "number" },
  { key: "seats", label: "Posti", type: "number" },
  { key: "mass_max_kg", label: "Massa max (kg)", type: "number" },
  { key: "mass_service_kg", label: "Massa in servizio (kg)", type: "number" },
  { key: "euro_class", label: "Classe ambientale" },
  { key: "first_registration", label: "Prima immatricolazione", type: "date" },
  { key: "last_inspection", label: "Ultima revisione", type: "date" },
  { key: "next_inspection", label: "Prossima revisione", type: "date" },
  { key: "owner_name", label: "Intestatario", wide: true },
  { key: "owner_address", label: "Residenza / sede", wide: true },
];

// Aggiorna un campo e, se la revisione è ancora una stima, la ricalcola.
export function setField(f: LibrettoFields, key: keyof LibrettoFields, value: string): LibrettoFields {
  const next: LibrettoFields = { ...f, [key]: value };
  if (key === "next_inspection") next.next_inspection_estimated = false;
  if (f.next_inspection_estimated && ["first_registration", "last_inspection", "category", "mass_max_kg"].includes(key)) {
    const est = estimateNextInspection(next);
    if (est) next.next_inspection = est;
  }
  return next;
}

export function FieldGrid({ fields, found, onChange }: {
  fields: LibrettoFields; found?: string[]; onChange: (key: keyof LibrettoFields, value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
      {FIELD_DEFS.map(d => {
        const missing = found && !found.includes(d.key) && d.key !== "next_inspection" && d.key !== "last_inspection";
        const value = String(fields[d.key] ?? "");
        return (
          <label key={d.key} style={{ gridColumn: d.wide ? "1 / -1" : undefined }}>
            <span className="font-semibold uppercase tracking-widest" style={{ fontSize: 9, color: "#8e9192" }}>
              {d.label}{d.key === "next_inspection" && fields.next_inspection_estimated ? " · stimata" : ""}
            </span>
            <input value={value} type={d.type === "date" ? "date" : "text"} inputMode={d.type === "number" ? "decimal" : undefined}
              onChange={e => onChange(d.key, e.target.value)}
              className="w-full text-white text-sm outline-none"
              style={{ background: "#292a2e", borderRadius: 10, padding: "8px 10px", marginTop: 3,
                       border: missing && !value ? "1px solid rgba(250,204,21,0.55)" : "1px solid transparent" }} />
          </label>
        );
      })}
    </div>
  );
}

interface Item {
  key: number;
  file_name: string;
  status: "reading" | "ready" | "error" | "created";
  file_id?: number;
  fields: LibrettoFields;
  found: string[];
  warning?: string;
  imei: string;
  error?: string;
}

export default function LibrettoImport({ companies, companyId, onClose, onDone }: {
  companies: { id: number; name: string }[];
  companyId?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [company, setCompany] = useState<number | "">(companyId ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: number, p: Partial<Item>) => setItems(a => a.map(i => (i.key === key ? { ...i, ...p } : i)));

  async function addFiles(files: FileList | null) {
    if (!files || !company) return;
    const list = Array.from(files);
    const fresh: Item[] = list.map(f => ({ key: ++counter.current, file_name: f.name, status: "reading", fields: { ...EMPTY_FIELDS }, found: [], imei: "" }));
    setItems(a => [...a, ...fresh]);
    // Un file alla volta: la lettura richiede alcuni secondi e non vogliamo sovraccaricare Brainy.
    for (let n = 0; n < list.length; n++) {
      const fd = new FormData();
      fd.append("file", list[n]);
      fd.append("company_id", String(company));
      try {
        const r = await fetch("/api/vehicles/libretto/extract", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({ error: `Errore del server (${r.status}): riprova tra un minuto` }));
        if (!r.ok) throw new Error(d.error ?? "Errore");
        patch(fresh[n].key, { status: "ready", file_id: d.file_id, fields: d.fields, found: d.found, warning: d.warning });
      } catch (e) {
        patch(fresh[n].key, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (input.current) input.current.value = "";
  }

  async function create() {
    const ready = items.filter(i => i.status === "ready" && i.file_id);
    if (!ready.length || !company) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/vehicles/libretto/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company, items: ready.map(i => ({ file_id: i.file_id, fields: i.fields, imei: i.imei })) }),
      });
      const d = await r.json().catch(() => ({ error: `Errore del server (${r.status}): riprova tra un minuto` }));
      if (!r.ok) throw new Error(d.error ?? "Errore");
      for (const res of d.results as { file_id: number; ok: boolean; error?: string }[]) {
        const it = items.find(i => i.file_id === res.file_id);
        if (it) patch(it.key, res.ok ? { status: "created" } : { error: res.error });
      }
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const readyCount = items.filter(i => i.status === "ready").length;
  const reading = items.some(i => i.status === "reading");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.85)", overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "relative", margin: "20px auto 80px", maxWidth: 760, background: "#1e1f23", borderRadius: 16, padding: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <h3 className="font-bold text-white" style={{ fontSize: 18 }}>Carica libretti</h3>
          <button type="button" onClick={onClose} style={{ color: "#8e9192" }}><X className="w-5 h-5" /></button>
        </div>
        <p style={{ fontSize: 12, color: "#8e9192", marginBottom: 16 }}>
          Ogni libretto (foto o PDF) viene letto dal modello di Brainy; controlla i dati, poi crea i veicoli con la loro scheda.
          I campi in giallo non sono stati letti. Facoltativo: l&apos;IMEI del sensore Ruptela collega subito i dati del veicolo.
        </p>

        <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          {companyId == null && (
            <select value={company} onChange={e => setCompany(e.target.value ? Number(e.target.value) : "")}
              className="text-white text-sm outline-none" style={{ background: "#292a2e", borderRadius: 12, padding: "10px 14px" }}>
              <option value="">Scegli l&apos;azienda…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button type="button" disabled={!company} onClick={() => input.current?.click()}
            className="flex items-center gap-2 font-bold disabled:opacity-40"
            style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "10px 14px", fontSize: 13 }}>
            <FileUp className="w-4 h-4" /> Scegli i file
          </button>
          <input ref={input} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" hidden
            onChange={e => addFiles(e.target.files)} />
        </div>

        {error && <div className="flex items-start gap-2 rounded-xl p-3 mb-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f87171" }} /><span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span></div>}

        <div className="flex flex-col gap-3">
          {items.map(i => (
            <div key={i.key} style={{ background: "#16171a", borderRadius: 14, padding: 14 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: i.status === "ready" ? 10 : 0 }}>
                <span className="text-white font-semibold truncate flex-1" style={{ fontSize: 13 }}>{i.file_name}</span>
                {i.status === "reading" && <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: "#8e9192" }}><Loader2 className="w-4 h-4 animate-spin" /> lettura…</span>}
                {i.status === "created" && <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: "#4ade80" }}><CheckCircle2 className="w-4 h-4" /> creato</span>}
                {i.status !== "created" && i.status !== "reading" && (
                  <button type="button" onClick={() => setItems(a => a.filter(x => x.key !== i.key))} style={{ color: "#f87171" }}><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              {i.status === "error" && <p style={{ fontSize: 12, color: "#fca5a5" }}>{i.error}</p>}
              {i.status === "ready" && (
                <>
                  {i.warning && <p style={{ fontSize: 12, color: "#facc15", marginBottom: 8 }}>{i.warning}</p>}
                  {i.error && <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 8 }}>{i.error}</p>}
                  <FieldGrid fields={i.fields} found={i.found} onChange={(k, v) => patch(i.key, { fields: setField(i.fields, k, v), error: undefined })} />
                  <label style={{ display: "block", marginTop: 10 }}>
                    <span className="font-semibold uppercase tracking-widest" style={{ fontSize: 9, color: "#8e9192" }}>IMEI sensore Ruptela (facoltativo)</span>
                    <input value={i.imei} onChange={e => patch(i.key, { imei: e.target.value })} inputMode="numeric" maxLength={15}
                      className="w-full text-white text-sm outline-none" style={{ background: "#292a2e", borderRadius: 10, padding: "8px 10px", marginTop: 3 }} />
                  </label>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3" style={{ marginTop: 18 }}>
          <button type="button" onClick={onClose} className="flex-1 font-bold" style={{ background: "#292a2e", color: "#fff", borderRadius: 14, padding: 13, fontSize: 14 }}>Chiudi</button>
          <button type="button" disabled={busy || reading || !readyCount} onClick={create}
            className="flex-1 flex items-center justify-center gap-2 font-bold disabled:opacity-40"
            style={{ background: "#fff", color: "#000", borderRadius: 14, padding: 13, fontSize: 14 }}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Creo…</> : `Crea ${readyCount || ""} veicol${readyCount === 1 ? "o" : "i"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
