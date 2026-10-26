"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, FileUp, Loader2, Pencil, ChevronDown } from "lucide-react";
import { EMPTY_FIELDS, type LibrettoFields } from "@/lib/libretto";
import { FIELD_DEFS, FieldGrid, setField } from "@/components/LibrettoImport";

interface CardResponse {
  has_card: boolean;
  can_edit: boolean;
  card: (Record<string, unknown> & { libretto_url?: string | null; imei?: string | null }) | null;
  vehicle: { id: number; token_id: number; name: string; company_id: number | null };
}

function toFields(c: Record<string, unknown> | null): LibrettoFields {
  const f = { ...EMPTY_FIELDS } as Record<string, unknown>;
  if (c) {
    for (const d of FIELD_DEFS) {
      const v = c[d.key];
      f[d.key] = v == null ? "" : d.type === "date" ? String(v).slice(0, 10) : String(v);
    }
    f.next_inspection_estimated = c.next_inspection_estimated === true;
  }
  return f as unknown as LibrettoFields;
}

const fmtDate = (v: string) => (v ? new Date(v).toLocaleDateString("it-IT") : "—");

// Colora la scadenza: scaduta = rosso, entro 60 giorni = giallo.
function dueColor(iso: string): string {
  if (!iso) return "#fff";
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return days < 0 ? "#f87171" : days < 60 ? "#facc15" : "#fff";
}

export default function VehicleSheet({ tokenId }: { tokenId: string }) {
  const [data, setData] = useState<CardResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [fields, setFields] = useState<LibrettoFields>(EMPTY_FIELDS);
  const [found, setFound] = useState<string[] | undefined>();
  const [fileId, setFileId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/vehicles/card?tokenId=${tokenId}`);
      if (!r.ok) return;
      const d: CardResponse = await r.json();
      setData(d);
      setFields(toFields(d.card));
    } catch { /* la scheda non è essenziale */ }
  }, [tokenId]);

  useEffect(() => { void load(); }, [load]);

  async function upload(file: File | undefined) {
    if (!file || !data) return;
    setBusy(true); setMsg("Lettura del libretto in corso…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (data.vehicle.company_id) fd.append("company_id", String(data.vehicle.company_id));
      const r = await fetch("/api/vehicles/libretto/extract", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Errore");
      setFields(d.fields); setFound(d.found); setFileId(d.file_id);
      setMsg(d.warning ?? "Controlla i dati letti e salva.");
      setEdit(true); setOpen(true);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/vehicles/card", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: Number(tokenId), fields, file_id: fileId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Errore");
      setEdit(false); setFileId(null); setFound(undefined); setMsg(null);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!data) return null;
  const { card, can_edit } = data;
  // Chi non gestisce l'azienda e non ha scheda non vede nulla
  if (!card && !can_edit) return null;

  const next = String(fields.next_inspection || "");
  const title = card ? `${[card.make, card.model].filter(Boolean).join(" ") || "Scheda veicolo"}` : "Scheda veicolo";

  return (
    <div style={{ background: "#1e1f23", borderRadius: 16, marginBottom: 16 }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left" style={{ padding: "14px 16px" }}>
        <FileText className="w-4 h-4" style={{ color: "#8e9192" }} />
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-white block truncate" style={{ fontSize: 14 }}>Scheda veicolo</span>
          <span className="block truncate" style={{ fontSize: 11, color: "#8e9192" }}>
            {card ? `${title}${fields.plate ? " · " + fields.plate : ""}` : "Nessun libretto caricato"}
          </span>
        </span>
        {card && next && (
          <span style={{ fontSize: 11, color: dueColor(next) }}>Revisione {fmtDate(next)}{fields.next_inspection_estimated ? " (stima)" : ""}</span>
        )}
        <ChevronDown className="w-4 h-4" style={{ color: "#8e9192", transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {msg && <p style={{ fontSize: 12, color: "#facc15", marginBottom: 10 }}>{msg}</p>}

          {edit ? (
            <>
              <FieldGrid fields={fields} found={found} onChange={(k, v) => setFields(f => setField(f, k, v))} />
              <div className="flex gap-3" style={{ marginTop: 14 }}>
                <button type="button" disabled={busy} onClick={() => { setEdit(false); setFields(toFields(card)); setFileId(null); setFound(undefined); setMsg(null); }}
                  className="flex-1 font-bold" style={{ background: "#292a2e", color: "#fff", borderRadius: 12, padding: 11, fontSize: 13 }}>Annulla</button>
                <button type="button" disabled={busy} onClick={save}
                  className="flex-1 flex items-center justify-center gap-2 font-bold disabled:opacity-50" style={{ background: "#fff", color: "#000", borderRadius: 12, padding: 11, fontSize: 13 }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
                </button>
              </div>
            </>
          ) : (
            <>
              {card ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                  {FIELD_DEFS.map(d => {
                    const raw = String(fields[d.key] ?? "");
                    if (!raw && d.key !== "next_inspection") return null;
                    const isDate = d.type === "date";
                    return (
                      <div key={d.key} style={{ gridColumn: d.wide ? "1 / -1" : undefined }}>
                        <p className="font-semibold uppercase tracking-widest" style={{ fontSize: 9, color: "#8e9192" }}>
                          {d.label}{d.key === "next_inspection" && fields.next_inspection_estimated ? " · stimata" : ""}
                        </p>
                        <p className="text-white" style={{ fontSize: 13, marginTop: 2, color: d.key === "next_inspection" ? dueColor(raw) : undefined }}>
                          {isDate ? fmtDate(raw) : raw || "—"}
                        </p>
                      </div>
                    );
                  })}
                  {card.imei && (
                    <div>
                      <p className="font-semibold uppercase tracking-widest" style={{ fontSize: 9, color: "#8e9192" }}>Sensore (IMEI)</p>
                      <p className="text-white" style={{ fontSize: 13, marginTop: 2 }}>{card.imei}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#8e9192" }}>Carica il libretto per compilare la scheda in automatico.</p>
              )}

              <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 14 }}>
                {card?.libretto_url && (
                  <a href={card.libretto_url} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ fontSize: 12, color: "#8e9192" }}>Apri il libretto</a>
                )}
                {can_edit && (
                  <>
                    {card && (
                      <button type="button" onClick={() => setEdit(true)} className="flex items-center gap-1.5 font-semibold" style={{ fontSize: 12, color: "#fff" }}>
                        <Pencil className="w-3.5 h-3.5" /> Modifica
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex items-center gap-1.5 font-semibold disabled:opacity-50" style={{ fontSize: 12, color: "#fff" }}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />} {card ? "Carica un nuovo libretto" : "Carica il libretto"}
                    </button>
                    <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={e => upload(e.target.files?.[0])} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
