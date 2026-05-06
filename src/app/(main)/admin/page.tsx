"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2, Users, Truck, Plus, Trash2, X,
  Loader2, AlertCircle, ChevronRight,
} from "lucide-react";

// ─── types ───────────────────────────────────────────────────────────────────

interface Company {
  id: number; name: string; created_at: string;
  user_count: number; vehicle_count: number;
}
interface AdminUser {
  id: number; email: string; role: string;
  company_id: number | null; company_name: string | null; created_at: string;
}
interface AdminVehicle {
  id: number; token_id: string; name: string | null; plate: string | null;
  company_id: number | null; company_name: string | null;
  user_id: number | null; user_email: string | null; created_at: string;
}

type Tab = "companies" | "users" | "vehicles";

// ─── role badge ──────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  super_admin: { bg: "rgba(139,92,246,0.15)", color: "#a78bfa" },
  admin:       { bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
  user:        { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.user;
  return (
    <span
      className="font-bold uppercase tracking-widest"
      style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color }}
    >
      {role.replace("_", " ")}
    </span>
  );
}

// ─── modal ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full"
        style={{ background: "#1e1f23", borderRadius: "20px 20px 0 0", padding: 24, maxWidth: 480, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white" style={{ fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ color: "#8e9192" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── field ───────────────────────────────────────────────────────────────────

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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", caretColor: "#fff", ...props.style }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full text-white text-sm outline-none"
      style={{ background: "#292a2e", borderRadius: 12, padding: "11px 14px", ...props.style }}
    />
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center justify-center gap-2 font-bold w-full disabled:opacity-50"
      style={{ background: "#fff", color: "#000", borderRadius: 14, padding: "13px", fontSize: 14, marginTop: 4 }}
    >
      {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{label}…</> : label}
    </button>
  );
}

// ─── tab: aziende ────────────────────────────────────────────────────────────

function CompaniesTab() {
  const [data,    setData]    = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState(false);
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/admin/companies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (r.ok) { setModal(false); setName(""); load(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questa azienda?")) return;
    await fetch(`/api/admin/companies?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 13, color: "#8e9192" }}>{data.length} aziend{data.length === 1 ? "a" : "e"}</p>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 font-bold"
          style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "8px 14px", fontSize: 13 }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuova azienda
        </button>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>}
      {error   && <ErrBanner msg={error} />}

      <div className="flex flex-col gap-2">
        {data.map((c) => (
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
            <button onClick={() => del(c.id)} className="shrink-0 p-1.5 rounded-lg transition-opacity active:opacity-60" style={{ color: "#f87171" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {!loading && data.length === 0 && <EmptyState label="Nessuna azienda" />}
      </div>

      {modal && (
        <Modal title="Nuova azienda" onClose={() => setModal(false)}>
          <form onSubmit={create}>
            <Field label="Nome azienda">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="es. Acme Srl" required autoFocus />
            </Field>
            <SubmitBtn loading={saving} label="Crea azienda" />
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── tab: utenti ─────────────────────────────────────────────────────────────

function UsersTab({ companies }: { companies: Company[] }) {
  const [data,     setData]     = useState<AdminUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [modal,    setModal]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "user", company_id: "" });

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, company_id: form.company_id ? Number(form.company_id) : null }),
    });
    setSaving(false);
    if (r.ok) { setModal(false); setForm({ email: "", password: "", role: "user", company_id: "" }); load(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questo utente?")) return;
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 13, color: "#8e9192" }}>{data.length} utent{data.length === 1 ? "e" : "i"}</p>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 font-bold"
          style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "8px 14px", fontSize: 13 }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuovo utente
        </button>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>}
      {error   && <ErrBanner msg={error} />}

      <div className="flex flex-col gap-2">
        {data.map((u) => (
          <div key={u.id} className="flex items-center gap-3" style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
            <div
              className="flex items-center justify-center shrink-0 font-bold text-white rounded-full"
              style={{ width: 38, height: 38, background: "#292a2e", fontSize: 14 }}
            >
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
            </div>
            <button onClick={() => del(u.id)} className="shrink-0 p-1.5 rounded-lg transition-opacity active:opacity-60" style={{ color: "#f87171" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {!loading && data.length === 0 && <EmptyState label="Nessun utente" />}
      </div>

      {modal && (
        <Modal title="Nuovo utente" onClose={() => setModal(false)}>
          <form onSubmit={create}>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="nome@azienda.com" required autoFocus />
            </Field>
            <Field label="Password">
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
            </Field>
            <Field label="Ruolo">
              <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </Select>
            </Field>
            <Field label="Azienda (opzionale)">
              <Select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                <option value="">— nessuna —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <SubmitBtn loading={saving} label="Crea utente" />
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── tab: veicoli ─────────────────────────────────────────────────────────────

function VehiclesTab({ companies, users }: { companies: Company[]; users: AdminUser[] }) {
  const [data,    setData]    = useState<AdminVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ token_id: "", name: "", plate: "", company_id: "", user_id: "" });

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/admin/vehicles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        company_id: form.company_id ? Number(form.company_id) : null,
        user_id:    form.user_id    ? Number(form.user_id)    : null,
      }),
    });
    setSaving(false);
    if (r.ok) { setModal(false); setForm({ token_id: "", name: "", plate: "", company_id: "", user_id: "" }); load(); }
    else { const d = await r.json(); setError(d.error); }
  }

  async function del(id: number) {
    if (!confirm("Eliminare questo veicolo?")) return;
    await fetch(`/api/admin/vehicles?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 13, color: "#8e9192" }}>{data.length} veicol{data.length === 1 ? "o" : "i"}</p>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 font-bold"
          style={{ background: "#fff", color: "#000", borderRadius: 12, padding: "8px 14px", fontSize: 13 }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuovo veicolo
        </button>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>}
      {error   && <ErrBanner msg={error} />}

      <div className="flex flex-col gap-2">
        {data.map((v) => (
          <div key={v.id} className="flex items-center gap-3" style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
            <div className="flex items-center justify-center shrink-0" style={{ width: 38, height: 38, background: "#292a2e", borderRadius: 10 }}>
              <Truck className="w-4 h-4" style={{ color: "#9ca3af" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate" style={{ fontSize: 13 }}>
                {v.name ?? v.token_id}
                {v.plate && <span style={{ color: "#8e9192" }}> · {v.plate}</span>}
              </p>
              <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>
                #{v.token_id} · {v.company_name ?? "—"} · {v.user_email ?? "non assegnato"}
              </p>
            </div>
            <button onClick={() => del(v.id)} className="shrink-0 p-1.5 rounded-lg transition-opacity active:opacity-60" style={{ color: "#f87171" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {!loading && data.length === 0 && <EmptyState label="Nessun veicolo" />}
      </div>

      {modal && (
        <Modal title="Nuovo veicolo" onClose={() => setModal(false)}>
          <form onSubmit={create}>
            <Field label="Token ID">
              <Input value={form.token_id} onChange={e => setForm(f => ({ ...f, token_id: e.target.value }))} placeholder="es. 12345" required autoFocus />
            </Field>
            <Field label="Nome (opzionale)">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="es. Renault Trafic" />
            </Field>
            <Field label="Targa (opzionale)">
              <Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="es. AB123CD" />
            </Field>
            <Field label="Azienda (opzionale)">
              <Select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                <option value="">— nessuna —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Utente assegnato (opzionale)">
              <Select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
                <option value="">— nessuno —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </Select>
            </Field>
            <SubmitBtn loading={saving} label="Crea veicolo" />
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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
    <div className="flex flex-col items-center justify-center py-12 rounded-2xl" style={{ background: "#1e1f23" }}>
      <p className="font-semibold text-white" style={{ fontSize: 14 }}>{label}</p>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "companies", label: "Aziende",  icon: Building2 },
  { value: "users",     label: "Utenti",   icon: Users     },
  { value: "vehicles",  label: "Veicoli",  icon: Truck     },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab,       setTab]       = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users,     setUsers]     = useState<AdminUser[]>([]);

  const role = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role !== "super_admin") router.push("/vehicles");
  }, [status, role, router]);

  // Ensure tables exist, then load shared lists for child forms
  useEffect(() => {
    if (role !== "super_admin") return;
    fetch("/api/admin/migrate", { method: "POST" }).then(() => {
      fetch("/api/admin/companies").then(r => r.json()).then(d => { if (Array.isArray(d)) setCompanies(d); });
      fetch("/api/admin/users").then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); });
    });
  }, [role]);

  if (status === "loading" || role !== "super_admin") return null;

  return (
    <div className="px-4 pt-6 pb-8" style={{ minHeight: "100vh" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-2">
        <p className="font-bold text-white" style={{ fontSize: 16, lineHeight: 1 }}>MyMine</p>
        <p style={{ fontSize: 11, color: "#8e9192", marginTop: 2 }}>Vehicle Intelligence</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-white" style={{ fontSize: 28 }}>Admin</h1>
        <span
          className="font-bold uppercase tracking-widest"
          style={{ fontSize: 9, padding: "3px 10px", borderRadius: 999, background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
        >
          super admin
        </span>
      </div>

      {/* ── Tab selector ───────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5">
        {TABS.map(({ value, label, icon: Icon }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-colors"
              style={{ background: active ? "#1e1f23" : "transparent" }}
            >
              <Icon className="w-4 h-4" style={{ color: active ? "#ffffff" : "#8e9192" }} />
              <span className="font-semibold" style={{ fontSize: 11, color: active ? "#ffffff" : "#8e9192" }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      {tab === "companies" && <CompaniesTab />}
      {tab === "users"     && <UsersTab     companies={companies} />}
      {tab === "vehicles"  && <VehiclesTab  companies={companies} users={users} />}
    </div>
  );
}
