"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2, Users, Truck, Plus, Trash2, X,
  Loader2, AlertCircle, Pencil,
} from "lucide-react";

// ─── types ───────────────────────────────────────────────────────────────────

interface Company {
  id: number; name: string; created_at: string;
  user_count: number; vehicle_count: number;
}
interface UserRef    { id: number; email: string; }
interface VehicleRef { id: number; name: string; token_id: number; }

interface AdminUser {
  id: number; email: string; role: string;
  company_id: number | null; company_name: string | null;
  created_at: string; vehicles: VehicleRef[];
}
interface AdminVehicle {
  id: number; token_id: number; name: string;
  plate: string | null; company_id: number | null;
  company_name: string | null; created_at: string;
  users: UserRef[];
}

type Tab = "companies" | "vehicles" | "users";
type ModalMode = "create" | "edit" | null;

// ─── shared UI ───────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  super_admin: { bg: "rgba(139,92,246,0.15)", color: "#a78bfa" },
  admin:       { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
  user:        { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.user;
  return (
    <span className="font-bold uppercase tracking-widest shrink-0"
      style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color }}>
      {role.replace("_", " ")}
    </span>
  );
}

function Modal({ title, onClose, onSubmit, loading, submitLabel, children }: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void;
  loading: boolean; submitLabel: string; children: React.ReactNode;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.85)", overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit}
        style={{ position: "relative", margin: "20px auto 80px", maxWidth: 560, background: "#1e1f23", borderRadius: 16, padding: 24 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 className="font-bold text-white" style={{ fontSize: 18 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ color: "#8e9192" }}><X className="w-5 h-5" /></button>
        </div>
        {children}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button type="button" onClick={onClose} className="flex-1 font-bold"
            style={{ background: "#292a2e", color: "#fff", borderRadius: 14, padding: 13, fontSize: 14 }}>
            Annulla
          </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: "#8e9192" }}>{label}</label>
      {children}
    </div>
  );
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", caretColor: "#fff", ...props.style }} />
  );
}

function FSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", ...props.style }} />
  );
}

function CheckboxList<T extends { id: number }>({
  items, selectedIds, onToggle, renderLabel,
}: {
  items: T[]; selectedIds: number[];
  onToggle: (id: number) => void;
  renderLabel: (item: T) => string;
}) {
  if (!items.length) return (
    <p style={{ fontSize: 12, color: "#8e9192", padding: "8px 0" }}>Nessun elemento disponibile</p>
  );
  return (
    <div style={{ background: "#292a2e", borderRadius: 12, maxHeight: 160, overflowY: "auto", padding: "8px 0" }}>
      {items.map(item => (
        <label key={item.id} className="flex items-center gap-2.5 cursor-pointer px-3 py-1.5 hover:bg-white/5">
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={() => onToggle(item.id)}
            style={{ accentColor: "#fff", width: 14, height: 14 }}
          />
          <span className="text-white text-sm truncate">{renderLabel(item)}</span>
        </label>
      ))}
    </div>
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 rounded-2xl" style={{ background: "#1e1f23" }}>
      <p className="font-semibold text-white" style={{ fontSize: 14 }}>{label}</p>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button onClick={onEdit} className="p-1.5 rounded-lg active:opacity-60" style={{ color: "#8e9192" }}>
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-lg active:opacity-60" style={{ color: "#f87171" }}>
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── companies tab ───────────────────────────────────────────────────────────

function CompaniesTab({ onRefresh }: { onRefresh: () => void }) {
  const [data,    setData]    = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState<ModalMode>(null);
  const [target,  setTarget]  = useState<Company | null>(null);
  const [name,    setName]    = useState("");
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/companies");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setName(""); setTarget(null); setModal("create"); }
  function openEdit(c: Company) { setName(c.name); setTarget(c); setModal("edit"); }
  function close() { setModal(null); setTarget(null); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url  = modal === "edit" && target ? `/api/admin/companies/${target.id}` : "/api/admin/companies";
    const method = modal === "edit" ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setSaving(false);
    if (r.ok) { close(); load(); onRefresh(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questa azienda?")) return;
    await fetch(`/api/admin/companies?id=${id}`, { method: "DELETE" });
    load(); onRefresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 13, color: "#8e9192" }}>{data.length} aziend{data.length === 1 ? "a" : "e"}</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 font-bold"
          style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "8px 14px", fontSize: 13 }}>
          <Plus className="w-3.5 h-3.5" /> Nuova
        </button>
      </div>
      {loading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>}
      {error && <ErrBanner msg={error} />}
      <div className="flex flex-col gap-2">
        {data.map(c => (
          <div key={c.id} className="flex items-center gap-3" style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
            <div className="flex items-center justify-center shrink-0" style={{ width: 38, height: 38, background: "#292a2e", borderRadius: 10 }}>
              <Building2 className="w-4 h-4" style={{ color: "#8e9192" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate" style={{ fontSize: 14 }}>{c.name}</p>
              <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>
                {c.user_count} utent{c.user_count === 1 ? "e" : "i"} · {c.vehicle_count} veicol{c.vehicle_count === 1 ? "o" : "i"}
              </p>
            </div>
            <RowActions onEdit={() => openEdit(c)} onDelete={() => del(c.id)} />
          </div>
        ))}
        {!loading && data.length === 0 && <EmptyState label="Nessuna azienda" />}
      </div>

      {(modal === "create" || modal === "edit") && (
        <Modal title={modal === "create" ? "Nuova azienda" : "Modifica azienda"}
          onClose={close} onSubmit={save} loading={saving}
          submitLabel={modal === "create" ? "Crea" : "Salva"}>
          <Field label="Nome azienda">
            <FInput value={name} onChange={e => setName(e.target.value)} placeholder="es. Acme Srl" required autoFocus />
          </Field>
        </Modal>
      )}
    </>
  );
}

// ─── vehicles tab ─────────────────────────────────────────────────────────────

const EMPTY_V = { token_id: "", name: "", plate: "", company_id: "" };

function VehiclesTab({ companies, allUsers, onRefresh }: {
  companies: Company[]; allUsers: AdminUser[]; onRefresh: () => void;
}) {
  const [data,       setData]       = useState<AdminVehicle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [modal,      setModal]      = useState<ModalMode>(null);
  const [target,     setTarget]     = useState<AdminVehicle | null>(null);
  const [form,       setForm]       = useState(EMPTY_V);
  const [selUsers,   setSelUsers]   = useState<number[]>([]);
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/vehicles");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_V); setSelUsers([]); setTarget(null); setModal("create");
  }
  function openEdit(v: AdminVehicle) {
    setForm({ token_id: String(v.token_id), name: v.name, plate: v.plate ?? "", company_id: v.company_id ? String(v.company_id) : "" });
    setSelUsers(v.users.map(u => u.id));
    setTarget(v); setModal("edit");
  }
  function close() { setModal(null); setTarget(null); }

  function toggleUser(id: number) {
    setSelUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      token_id: Number(form.token_id),
      name: form.name,
      plate: form.plate || null,
      company_id: form.company_id ? Number(form.company_id) : null,
      user_ids: selUsers,
    };
    const url    = modal === "edit" && target ? `/api/admin/vehicles/${target.id}` : "/api/admin/vehicles";
    const method = modal === "edit" ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (r.ok) { close(); load(); onRefresh(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questo veicolo?")) return;
    await fetch(`/api/admin/vehicles?id=${id}`, { method: "DELETE" });
    load(); onRefresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 13, color: "#8e9192" }}>{data.length} veicol{data.length === 1 ? "o" : "i"}</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 font-bold"
          style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "8px 14px", fontSize: 13 }}>
          <Plus className="w-3.5 h-3.5" /> Nuovo
        </button>
      </div>
      {loading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>}
      {error && <ErrBanner msg={error} />}
      <div className="flex flex-col gap-2">
        {data.map(v => (
          <div key={v.id} style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center shrink-0" style={{ width: 38, height: 38, background: "#292a2e", borderRadius: 10 }}>
                <Truck className="w-4 h-4" style={{ color: "#9ca3af" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate" style={{ fontSize: 14 }}>
                  {v.name}
                  {v.plate && <span style={{ color: "#8e9192" }}> · {v.plate}</span>}
                </p>
                <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>
                  #{v.token_id} · {v.company_name ?? "—"}
                </p>
                {v.users.length > 0 && (
                  <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>
                    {v.users.map(u => u.email).join(", ")}
                  </p>
                )}
              </div>
              <RowActions onEdit={() => openEdit(v)} onDelete={() => del(v.id)} />
            </div>
          </div>
        ))}
        {!loading && data.length === 0 && <EmptyState label="Nessun veicolo" />}
      </div>

      {(modal === "create" || modal === "edit") && (
        <Modal title={modal === "create" ? "Nuovo veicolo" : "Modifica veicolo"}
          onClose={close} onSubmit={save} loading={saving}
          submitLabel={modal === "create" ? "Crea" : "Salva"}>
          <Field label="Token ID (DIMO)">
            <FInput type="number" value={form.token_id}
              onChange={e => setForm(f => ({ ...f, token_id: e.target.value }))}
              placeholder="es. 188611" required autoFocus />
          </Field>
          <Field label="Nome veicolo">
            <FInput value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="es. Mercedes Sprinter" required />
          </Field>
          <Field label="Targa (opzionale)">
            <FInput value={form.plate}
              onChange={e => setForm(f => ({ ...f, plate: e.target.value }))}
              placeholder="es. AB123CD" />
          </Field>
          <Field label="Azienda (opzionale)">
            <FSelect value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
              <option value="">— nessuna —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FSelect>
          </Field>
          <Field label="Utenti assegnati">
            <CheckboxList
              items={allUsers}
              selectedIds={selUsers}
              onToggle={toggleUser}
              renderLabel={u => u.email}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}

// ─── users tab ────────────────────────────────────────────────────────────────

const EMPTY_U_CREATE = { email: "", password: "", role: "user", company_id: "" };
const EMPTY_U_EDIT   = { email: "", role: "user", company_id: "", new_password: "" };

function UsersTab({ companies, allVehicles, onRefresh }: {
  companies: Company[]; allVehicles: AdminVehicle[]; onRefresh: () => void;
}) {
  const [data,      setData]      = useState<AdminUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [modal,     setModal]     = useState<ModalMode>(null);
  const [target,    setTarget]    = useState<AdminUser | null>(null);
  const [cForm,     setCForm]     = useState(EMPTY_U_CREATE);
  const [eForm,     setEForm]     = useState(EMPTY_U_EDIT);
  const [selVehs,   setSelVehs]   = useState<number[]>([]);
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setCForm(EMPTY_U_CREATE); setSelVehs([]); setTarget(null); setModal("create");
  }
  function openEdit(u: AdminUser) {
    setEForm({ email: u.email, role: u.role, company_id: u.company_id ? String(u.company_id) : "", new_password: "" });
    setSelVehs(u.vehicles.map(v => v.id));
    setTarget(u); setModal("edit");
  }
  function close() { setModal(null); setTarget(null); }

  function toggleVeh(id: number) {
    setSelVehs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function saveCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cForm.email, password: cForm.password,
        role: cForm.role,
        company_id: cForm.company_id ? Number(cForm.company_id) : null,
        vehicle_ids: selVehs,
      }),
    });
    setSaving(false);
    if (r.ok) { close(); load(); onRefresh(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    setError(null);
    const r = await fetch(`/api/admin/users/${target.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: eForm.email, role: eForm.role,
        company_id: eForm.company_id ? Number(eForm.company_id) : null,
        password: eForm.new_password || undefined,
        vehicle_ids: selVehs,
      }),
    });
    setSaving(false);
    if (r.ok) { close(); load(); onRefresh(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questo utente?")) return;
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    load(); onRefresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 13, color: "#8e9192" }}>{data.length} utent{data.length === 1 ? "e" : "i"}</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 font-bold"
          style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "8px 14px", fontSize: 13 }}>
          <Plus className="w-3.5 h-3.5" /> Nuovo
        </button>
      </div>
      {loading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>}
      {error && <ErrBanner msg={error} />}
      <div className="flex flex-col gap-2">
        {data.map(u => (
          <div key={u.id} style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center shrink-0 font-bold text-white rounded-full"
                style={{ width: 38, height: 38, background: "#292a2e", fontSize: 14 }}>
                {u.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white truncate" style={{ fontSize: 13 }}>{u.email}</p>
                  <RoleBadge role={u.role} />
                </div>
                <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>
                  {u.company_name ?? "—"} · {new Date(u.created_at).toLocaleDateString("it-IT")}
                </p>
                {u.vehicles.length > 0 && (
                  <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>
                    {u.vehicles.map(v => v.name).join(", ")}
                  </p>
                )}
              </div>
              <RowActions onEdit={() => openEdit(u)} onDelete={() => del(u.id)} />
            </div>
          </div>
        ))}
        {!loading && data.length === 0 && <EmptyState label="Nessun utente" />}
      </div>

      {modal === "create" && (
        <Modal title="Nuovo utente" onClose={close} onSubmit={saveCreate} loading={saving} submitLabel="Crea">
          <Field label="Email">
            <FInput type="email" value={cForm.email} onChange={e => setCForm(f => ({ ...f, email: e.target.value }))}
              placeholder="nome@azienda.com" required autoFocus />
          </Field>
          <Field label="Password">
            <FInput type="password" value={cForm.password} onChange={e => setCForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" required />
          </Field>
          <Field label="Ruolo">
            <FSelect value={cForm.role} onChange={e => setCForm(f => ({ ...f, role: e.target.value }))}>
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </FSelect>
          </Field>
          <Field label="Azienda (opzionale)">
            <FSelect value={cForm.company_id} onChange={e => setCForm(f => ({ ...f, company_id: e.target.value }))}>
              <option value="">— nessuna —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FSelect>
          </Field>
          <Field label="Veicoli assegnati">
            <CheckboxList
              items={allVehicles}
              selectedIds={selVehs}
              onToggle={toggleVeh}
              renderLabel={v => `${v.name} · #${v.token_id}`}
            />
          </Field>
        </Modal>
      )}

      {modal === "edit" && target && (
        <Modal title="Modifica utente" onClose={close} onSubmit={saveEdit} loading={saving} submitLabel="Salva">
          <Field label="Email">
            <FInput type="email" value={eForm.email} onChange={e => setEForm(f => ({ ...f, email: e.target.value }))}
              placeholder="nome@azienda.com" required autoFocus />
          </Field>
          <Field label="Ruolo">
            <FSelect value={eForm.role} onChange={e => setEForm(f => ({ ...f, role: e.target.value }))}>
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </FSelect>
          </Field>
          <Field label="Azienda (opzionale)">
            <FSelect value={eForm.company_id} onChange={e => setEForm(f => ({ ...f, company_id: e.target.value }))}>
              <option value="">— nessuna —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FSelect>
          </Field>
          <Field label="Veicoli assegnati">
            <CheckboxList
              items={allVehicles}
              selectedIds={selVehs}
              onToggle={toggleVeh}
              renderLabel={v => `${v.name} · #${v.token_id}`}
            />
          </Field>
          <Field label="Nuova password (lascia vuoto per non cambiare)">
            <FInput type="password" value={eForm.new_password}
              onChange={e => setEForm(f => ({ ...f, new_password: e.target.value }))}
              placeholder="••••••••" />
          </Field>
        </Modal>
      )}
    </>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "companies", label: "Aziende",  icon: Building2 },
  { value: "vehicles",  label: "Veicoli",  icon: Truck     },
  { value: "users",     label: "Utenti",   icon: Users     },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab,         setTab]         = useState<Tab>("companies");
  const [companies,   setCompanies]   = useState<Company[]>([]);
  const [allUsers,    setAllUsers]    = useState<AdminUser[]>([]);
  const [allVehicles, setAllVehicles] = useState<AdminVehicle[]>([]);

  const role = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role !== "super_admin") router.push("/vehicles");
  }, [status, role, router]);

  const refreshShared = useCallback(() => {
    fetch("/api/admin/companies").then(r => r.json()).then(d => { if (Array.isArray(d)) setCompanies(d); });
    fetch("/api/admin/users").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllUsers(d); });
    fetch("/api/admin/vehicles").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllVehicles(d); });
  }, []);

  useEffect(() => {
    if (role !== "super_admin") return;
    fetch("/api/admin/migrate", { method: "POST" }).then(refreshShared);
  }, [role, refreshShared]);

  if (status === "loading" || role !== "super_admin") return null;

  return (
    <div className="px-4 pt-6 pb-8" style={{ minHeight: "100vh" }}>

      {/* header */}
      <div className="mb-2">
        <img src="/conexo-logo.png" alt="Conexo Technologies" style={{ height: 32 }} />
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-white" style={{ fontSize: 28 }}>Admin</h1>
        <span className="font-bold uppercase tracking-widest"
          style={{ fontSize: 9, padding: "3px 10px", borderRadius: 999, background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
          super admin
        </span>
      </div>

      {/* tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map(({ value, label, icon: Icon }) => {
          const active = tab === value;
          return (
            <button key={value} onClick={() => setTab(value)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-colors"
              style={{ background: active ? "#1e1f23" : "transparent" }}>
              <Icon className="w-4 h-4" style={{ color: active ? "#fff" : "#8e9192" }} />
              <span className="font-semibold" style={{ fontSize: 11, color: active ? "#fff" : "#8e9192" }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* content */}
      {tab === "companies" && <CompaniesTab onRefresh={refreshShared} />}
      {tab === "vehicles"  && <VehiclesTab  companies={companies} allUsers={allUsers}    onRefresh={refreshShared} />}
      {tab === "users"     && <UsersTab     companies={companies} allVehicles={allVehicles} onRefresh={refreshShared} />}
    </div>
  );
}
