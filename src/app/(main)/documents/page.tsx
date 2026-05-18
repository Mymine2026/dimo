"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FileText, Upload, X, Loader2, Trash2, AlertCircle, ExternalLink, Paperclip } from "lucide-react";
import { Vehicle } from "@/types/dimo";

// ─── types ───────────────────────────────────────────────────────────────────

interface AdminVehicle { id: number; token_id: string; name: string | null; plate: string | null; }
interface Doc {
  id: number;
  vehicle_id: number | null;
  vehicle_dimo_token: string | null;
  name: string;
  type: string;
  notes: string | null;
  file_url: string | null;
  created_at: string;
  vehicle_name: string | null;
  vehicle_token_id: string | null;
  vehicle_display: string | null;
}

// ─── doc type config ─────────────────────────────────────────────────────────

const DOC_TYPES: Record<string, { label: string; bg: string; color: string }> = {
  registration: { label: "Libretto",      bg: "rgba(96,165,250,0.15)",  color: "#60a5fa" },
  insurance:    { label: "Assicurazione", bg: "rgba(52,211,153,0.15)",  color: "#34d399" },
  maintenance:  { label: "Manutenzione",  bg: "rgba(251,191,36,0.15)",  color: "#fbbf24" },
  other:        { label: "Altro",         bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
};

function TypeBadge({ type }: { type: string }) {
  const t = DOC_TYPES[type] ?? DOC_TYPES.other;
  return (
    <span
      className="font-bold uppercase tracking-widest shrink-0"
      style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: t.bg, color: t.color }}
    >
      {t.label}
    </span>
  );
}

// ─── shared UI ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: "#8e9192" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", caretColor: "#fff", ...props.style }}
    />
  );
}

function FSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", ...props.style }}
    />
  );
}

function FTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full text-white text-sm outline-none resize-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", caretColor: "#fff", ...props.style }}
    />
  );
}

// ─── modal ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, onSubmit, loading, submitLabel, children }: {
  title: string; onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean; submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.8)", overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={onSubmit}
        style={{ position: "relative", margin: "20px auto 80px", maxWidth: 600, backgroundColor: "#1e1f23", borderRadius: 16, padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 className="font-bold text-white" style={{ fontSize: 18 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ color: "#8e9192" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            type="button" onClick={onClose}
            className="flex-1 font-bold"
            style={{ background: "#292a2e", color: "#fff", borderRadius: 14, padding: 13, fontSize: 14 }}
          >
            Annulla
          </button>
          <button
            type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 font-bold disabled:opacity-50"
            style={{ background: "#fff", color: "#000", borderRadius: 14, padding: 13, fontSize: 14 }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{submitLabel}…</> : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

const EMPTY_FORM = { vehicle_token: "", name: "", type: "other", notes: "" };

export default function DocumentsPage() {
  const [docs,          setDocs]          = useState<Doc[]>([]);
  const [adminVehicles, setAdminVehicles] = useState<AdminVehicle[]>([]);
  const [dimoVehicles,  setDimoVehicles]  = useState<Vehicle[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [modal,         setModal]         = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [file,          setFile]          = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, vehiclesRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/vehicles"),
      ]);
      const docsData = await docsRes.json();
      if (!docsRes.ok) throw new Error(docsData.error ?? "Errore caricamento documenti");
      setDocs(docsData.documents);
      setAdminVehicles(docsData.vehicles);
      if (vehiclesRes.ok) {
        const vData = await vehiclesRes.json();
        setDimoVehicles(Array.isArray(vData) ? vData : []);
      }
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const vehicleOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const dimoTokenIds = new Set(dimoVehicles.map(v => String(v.tokenId)));

    for (const v of dimoVehicles) {
      const { make, model, year } = v.definition;
      opts.push({ value: String(v.tokenId), label: `${make} ${model} ${year} · #${v.tokenId}` });
    }
    for (const v of adminVehicles) {
      if (!dimoTokenIds.has(v.token_id)) {
        opts.push({ value: v.token_id, label: `${v.name ?? v.token_id}${v.plate ? ` · ${v.plate}` : ""}` });
      }
    }
    return opts;
  }, [dimoVehicles, adminVehicles]);

  function getVehicleLabel(doc: Doc): string | null {
    if (doc.vehicle_display) return doc.vehicle_display;
    if (doc.vehicle_dimo_token) {
      const dv = dimoVehicles.find(v => String(v.tokenId) === doc.vehicle_dimo_token);
      if (dv) return `${dv.definition.make} ${dv.definition.model} ${dv.definition.year}`;
      return `#${doc.vehicle_dimo_token}`;
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let file_url: string | null = null;

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error ?? "Errore upload file");
        file_url = upData.url;
      }

      const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_dimo_token: form.vehicle_token || null,
          name: form.name,
          type: form.type,
          notes: form.notes,
          file_url,
        }),
      });

      if (r.ok) {
        setModal(false);
        setForm(EMPTY_FORM);
        setFile(null);
        load();
      } else {
        const d = await r.json();
        throw new Error(d.error ?? "Errore salvataggio");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questo documento?")) return;
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    load();
  }

  function closeModal() {
    setModal(false);
    setForm(EMPTY_FORM);
    setFile(null);
  }

  return (
    <div className="px-4 pt-6 pb-24" style={{ minHeight: "100vh" }}>

      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="mb-5">
        <img src="/conexo-logo.png" alt="Conexo Technologies" style={{ height: 32 }} />
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-white leading-none" style={{ fontSize: 28 }}>Documenti</h1>
          {!loading && (
            <p style={{ fontSize: 13, color: "#8e9192", marginTop: 4 }}>
              {docs.length} document{docs.length === 1 ? "o" : "i"} · archivio veicoli
            </p>
          )}
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 font-semibold"
          style={{ background: "#fff", color: "#000", fontSize: 13, padding: "8px 14px", borderRadius: 12 }}
        >
          <Upload className="w-4 h-4" />
          Carica
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl p-3 mb-4"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
          <span className="text-sm" style={{ color: "#fca5a5" }}>{error}</span>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!loading && docs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl" style={{ background: "#1e1f23" }}>
          <div className="flex items-center justify-center mb-4"
            style={{ width: 56, height: 56, background: "#292a2e", borderRadius: 16 }}>
            <FileText className="w-6 h-6" style={{ color: "#8e9192" }} />
          </div>
          <p className="font-semibold text-white mb-1" style={{ fontSize: 15 }}>Nessun documento</p>
          <p style={{ fontSize: 13, color: "#8e9192" }}>Carica il primo documento per iniziare</p>
        </div>
      )}

      {/* ── Document list ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {docs.map((doc) => {
          const vehicleLabel = getVehicleLabel(doc);
          return (
            <div key={doc.id} style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center shrink-0"
                  style={{ width: 38, height: 38, background: "#292a2e", borderRadius: 10, marginTop: 1 }}>
                  <FileText className="w-4 h-4" style={{ color: "#8e9192" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <TypeBadge type={doc.type} />
                    {vehicleLabel && (
                      <span style={{ fontSize: 10, color: "#8e9192" }}>{vehicleLabel}</span>
                    )}
                  </div>
                  <p className="font-semibold text-white truncate" style={{ fontSize: 14 }}>{doc.name}</p>
                  {doc.notes && (
                    <p style={{ fontSize: 12, color: "#8e9192", marginTop: 2 }} className="line-clamp-2">
                      {doc.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p style={{ fontSize: 11, color: "#8e9192" }}>
                      {new Date(doc.created_at).toLocaleDateString("it-IT", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-semibold"
                        style={{ fontSize: 11, color: "#60a5fa" }}
                      >
                        <Paperclip className="w-3 h-3" />
                        Apri file
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg" style={{ color: "#60a5fa" }}>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => del(doc.id)} className="p-1.5 rounded-lg" style={{ color: "#f87171" }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Upload modal ─────────────────────────────────────────── */}
      {modal && (
        <Modal
          title="Carica documento"
          onClose={closeModal}
          onSubmit={submit}
          loading={saving}
          submitLabel="Salva"
        >
          <Field label="Veicolo (opzionale)">
            <FSelect
              value={form.vehicle_token}
              onChange={e => setForm(f => ({ ...f, vehicle_token: e.target.value }))}
            >
              <option value="">— nessuno —</option>
              {vehicleOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </FSelect>
          </Field>
          <Field label="Tipo documento">
            <FSelect value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="registration">Libretto</option>
              <option value="insurance">Assicurazione</option>
              <option value="maintenance">Manutenzione</option>
              <option value="other">Altro</option>
            </FSelect>
          </Field>
          <Field label="Nome documento">
            <FInput
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="es. Revisione 2024"
              required
              autoFocus
            />
          </Field>
          <Field label="Note (opzionale)">
            <FTextarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Descrizione o note aggiuntive…"
              rows={3}
            />
          </Field>
          <Field label="File (PDF o immagine)">
            <div
              style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", cursor: "pointer" }}
              onClick={() => document.getElementById("doc-file-input")?.click()}
            >
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 shrink-0" style={{ color: "#8e9192" }} />
                <span className="text-sm truncate" style={{ color: file ? "#fff" : "#8e9192" }}>
                  {file ? file.name : "Seleziona file…"}
                </span>
              </div>
              <input
                id="doc-file-input"
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="flex items-center gap-1 mt-1"
                style={{ fontSize: 12, color: "#f87171" }}
              >
                <X className="w-3 h-3" /> Rimuovi file
              </button>
            )}
          </Field>
        </Modal>
      )}
    </div>
  );
}
