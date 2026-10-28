"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Risk } from "@/lib/contracts";

interface Row {
  vehicle_id: number; token_id: number; plate: string | null; name: string; lessor: string | null; sensor: boolean;
  risk: Risk; used: number | null; limit: number | null; usedPct: number | null; timePct: number | null;
  projected: number | null; overrun: number | null; overrunCost: number | null; endDate: string | null; daysLeft: number | null; missing: string[];
}
interface Att { severity: "alta" | "media" | "info"; token_id: number; text: string }
interface Overview {
  manage: boolean;
  kpis?: { vehicles: number; with_data: number; contracts_at_risk: number; deadlines_60d: number; sensors_silent: number };
  contracts?: Row[]; without_contract?: number; attention?: Att[];
}

const km = (n: number) => Math.round(n).toLocaleString("it-IT");
const BAR: Record<Risk, string> = { critico: "#e24b4a", attenzione: "#eda100", ok: "#1baf7a", nd: "#6b7280" };
const DOT: Record<Att["severity"], string> = { alta: "#f87171", media: "#facc15", info: "#8e9192" };

function chip(r: Row): { text: string; color: string; bg: string } {
  if (r.risk === "critico") return { text: r.overrun && r.overrun > 0 ? `+${km(r.overrun)} km` : "oltre i km", color: "#f87171", bg: "rgba(239,68,68,0.14)" };
  if (r.risk === "attenzione") return { text: "al limite", color: "#facc15", bg: "rgba(250,204,21,0.14)" };
  if (r.risk === "ok") return { text: "in regola", color: "#4ade80", bg: "rgba(74,222,128,0.12)" };
  return { text: r.sensor ? "dati incompleti" : "senza sensore", color: "#9ca3af", bg: "rgba(156,163,175,0.14)" };
}

function Kpi({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{ background: "#1e1f23", borderRadius: 14, padding: "12px 14px" }}>
      <p className="font-semibold" style={{ fontSize: 26, lineHeight: 1.1, color: color ?? "#fff" }}>{value}</p>
      <p style={{ fontSize: 11, color: "#8e9192", marginTop: 4 }}>{label}</p>
    </div>
  );
}

// Quadro di controllo della flotta per chi gestisce: indicatori, contratti in ordine di rischio, avvisi e mappa compatta.
export default function FleetControl({ mapSlot }: { mapSlot?: React.ReactNode }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/fleet/overview");
        if (!r.ok) throw new Error();
        setData(await r.json());
      } catch { setError(true); }
    })();
  }, []);

  if (error) return null;
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8e9192" }} /></div>;
  if (!data.manage || !data.kpis) return null;
  const k = data.kpis;
  const rows = data.contracts ?? [];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Kpi value={`${k.with_data}/${k.vehicles}`} label="Veicoli con dati nelle ultime 48 ore" />
        <Kpi value={k.contracts_at_risk} label="Contratti a rischio km" color={k.contracts_at_risk ? "#f87171" : undefined} />
        <Kpi value={k.deadlines_60d} label="Scadenze entro 60 giorni" color={k.deadlines_60d ? "#facc15" : undefined} />
        <Kpi value={k.sensors_silent} label="Sensori senza dati" />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1.5 1 380px", background: "#1e1f23", borderRadius: 16, padding: 16, minWidth: 0 }}>
          <p className="font-semibold text-white" style={{ fontSize: 14, marginBottom: 10 }}>Contratti e km, in ordine di rischio</p>
          {rows.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8e9192" }}>Nessun contratto inserito. Apri un veicolo e usa «Inserisci» nella scheda del contratto.</p>
          ) : rows.map((r, i) => {
            const c = chip(r);
            return (
              <Link key={r.vehicle_id} href={`/vehicles/${r.token_id}`} className="flex items-center gap-3"
                style={{ padding: "9px 0", borderTop: i ? "1px solid #292a2e" : undefined }} title={r.missing.length ? `Manca: ${r.missing.join(", ")}` : undefined}>
                <div style={{ width: 150, minWidth: 0 }}>
                  <p className="font-semibold text-white truncate" style={{ fontSize: 13 }}>{r.plate ?? r.name}</p>
                  <p className="truncate" style={{ fontSize: 11, color: "#8e9192" }}>{r.plate ? r.name : ""}{r.lessor ? ` · ${r.lessor}` : ""}</p>
                </div>
                <div style={{ flex: 1, position: "relative", height: 8, background: "#16171a", borderRadius: 4, overflow: "hidden" }}>
                  {r.usedPct != null && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(2, Math.min(100, r.usedPct))}%`, background: BAR[r.risk], borderRadius: 4 }} />}
                  {r.timePct != null && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, r.timePct)}%`, width: 2, background: "#fff" }} />}
                </div>
                <span style={{ width: 38, textAlign: "right", fontSize: 12, color: "#c4c7c8" }}>{r.usedPct != null ? `${Math.round(r.usedPct)}%` : "–"}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: c.bg, color: c.color, whiteSpace: "nowrap" }}>{c.text}</span>
              </Link>
            );
          })}
          {(data.without_contract ?? 0) > 0 && rows.length > 0 && (
            <p style={{ fontSize: 11, color: "#8e9192", marginTop: 10 }}>{data.without_contract} veicoli senza contratto inserito. La linea bianca indica la quota di tempo già trascorsa.</p>
          )}
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#1e1f23", borderRadius: 16, padding: 16 }}>
            <p className="font-semibold text-white" style={{ fontSize: 14, marginBottom: 8 }}>Richiede attenzione</p>
            {(data.attention ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: "#8e9192" }}>Nessun avviso: contratti, scadenze e sensori sono in regola.</p>
            ) : (data.attention ?? []).map((a, i) => (
              <Link key={i} href={`/vehicles/${a.token_id}`} className="flex items-start gap-2" style={{ padding: "6px 0", borderTop: i ? "1px solid #292a2e" : undefined }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[a.severity], marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#e5e7eb" }}>{a.text}</span>
              </Link>
            ))}
          </div>
          {mapSlot}
        </div>
      </div>
    </div>
  );
}
