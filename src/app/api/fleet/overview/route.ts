import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, canManage, listAccessibleVehicles } from "@/lib/access";
import { computeKm, riskOrder, type ContractFields, type Risk } from "@/lib/contracts";

interface Attention { severity: "alta" | "media" | "info"; token_id: number; plate: string | null; name: string; text: string }

const fmt = (n: number) => Math.round(n).toLocaleString("it-IT");
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { month: "long", year: "numeric" });

// Quadro di controllo della flotta: indicatori, contratti in ordine di rischio e avvisi. Solo per chi gestisce.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ manage: false });

  const vehicles = await listAccessibleVehicles(user);
  const ids = vehicles.map((v) => v.id);
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(today + "T00:00:00Z").getTime();

  const [contracts, now, prev, recent, devices, cards] = await Promise.all([
    pool.query(
      `SELECT vehicle_id, lessor, delivery_date::text AS delivery_date, months, km_total, end_date::text AS end_date,
              extra_km_cost::float8 AS extra_km_cost, km_total_extended, end_date_extended::text AS end_date_extended, odometer_start
         FROM vehicle_contracts WHERE vehicle_id = ANY($1)`, [ids]),
    pool.query(
      `SELECT DISTINCT ON (vehicle_id) vehicle_id, odometer_km::float8 AS km FROM telemetry
        WHERE vehicle_id = ANY($1) AND odometer_km IS NOT NULL ORDER BY vehicle_id, recorded_at DESC`, [ids]),
    pool.query(
      `SELECT DISTINCT ON (vehicle_id) vehicle_id, odometer_km::float8 AS km, recorded_at FROM telemetry
        WHERE vehicle_id = ANY($1) AND odometer_km IS NOT NULL AND recorded_at >= NOW() - INTERVAL '60 days'
        ORDER BY vehicle_id, recorded_at ASC`, [ids]),
    pool.query(`SELECT DISTINCT vehicle_id FROM telemetry WHERE vehicle_id = ANY($1) AND recorded_at > NOW() - INTERVAL '48 hours'`, [ids]),
    pool.query(`SELECT vehicle_id, last_seen_at FROM devices WHERE enabled AND vehicle_id = ANY($1)`, [ids]),
    pool.query(`SELECT vehicle_id, next_inspection::text AS next_inspection, next_inspection_estimated FROM vehicle_cards WHERE vehicle_id = ANY($1) AND next_inspection IS NOT NULL`, [ids]),
  ]);

  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const odoNow = new Map<number, number>(now.rows.map((r) => [r.vehicle_id, Number(r.km)]));
  const odoPrev = new Map<number, { km: number; date: string }>(prev.rows.map((r) => [r.vehicle_id, { km: Number(r.km), date: new Date(r.recorded_at).toISOString().slice(0, 10) }]));
  const sensorOf = new Map<number, Date | null>(devices.rows.map((r) => [r.vehicle_id, r.last_seen_at ? new Date(r.last_seen_at) : null]));

  const attention: Attention[] = [];
  const add = (a: Attention) => attention.push(a);
  const deadlineIds = new Set<number>();

  const rows = contracts.rows.map((c) => {
    const v = byId.get(c.vehicle_id)!;
    const s = computeKm(c as ContractFields, odoNow.get(c.vehicle_id) ?? null, odoPrev.get(c.vehicle_id) ?? null, today);
    const label = v.plate || v.name;
    if (s.risk === "critico") {
      add({ severity: "alta", token_id: v.token_id, plate: v.plate, name: v.name,
        text: s.used != null && s.limit && s.used > s.limit
          ? `${label}: già oltre i km inclusi (${fmt(s.used)} su ${fmt(s.limit)})`
          : `${label}: oltre i km inclusi${s.limitDate ? ` da ${monthYear(s.limitDate)}` : ""}${s.overrunCost ? `, extra stimato ${fmt(s.overrunCost)} €` : ""}` });
    } else if (s.risk === "attenzione") {
      add({ severity: "media", token_id: v.token_id, plate: v.plate, name: v.name,
        text: `${label}: vicino al limite dei km${s.limitDate ? `, si raggiungono a ${monthYear(s.limitDate)}` : ""}` });
    }
    if (s.daysLeft != null && s.daysLeft <= 60 && s.endDate) {
      deadlineIds.add(c.vehicle_id);
      add({ severity: s.daysLeft <= 30 ? "alta" : "media", token_id: v.token_id, plate: v.plate, name: v.name, text: `${label}: scadenza del noleggio tra ${s.daysLeft} giorni` });
    }
    return {
      vehicle_id: c.vehicle_id, token_id: v.token_id, plate: v.plate, name: v.name, company_id: v.company_id, lessor: c.lessor,
      sensor: sensorOf.has(c.vehicle_id) || odoNow.has(c.vehicle_id),
      risk: s.risk as Risk, used: s.used, limit: s.limit, usedPct: s.usedPct, timePct: s.timePct,
      projected: s.projected, overrun: s.overrun, overrunCost: s.overrunCost, endDate: s.endDate, daysLeft: s.daysLeft, missing: s.missing,
    };
  });
  rows.sort((a, b) => riskOrder(a.risk) - riskOrder(b.risk) || (b.usedPct ?? -1) - (a.usedPct ?? -1));

  for (const c of cards.rows) {
    const v = byId.get(c.vehicle_id);
    if (!v) continue;
    const days = Math.round((new Date(c.next_inspection + "T00:00:00Z").getTime() - todayMs) / 86_400_000);
    if (days <= 60) {
      deadlineIds.add(c.vehicle_id);
      add({ severity: days < 0 ? "alta" : days <= 30 ? "media" : "info", token_id: v.token_id, plate: v.plate, name: v.name,
        text: `${v.plate || v.name}: revisione ${days < 0 ? `scaduta da ${-days} giorni` : `tra ${days} giorni`}${c.next_inspection_estimated ? " (stimata)" : ""}` });
    }
  }

  let silent = 0;
  for (const [vid, seen] of sensorOf) {
    const hours = seen ? (Date.now() - seen.getTime()) / 3_600_000 : null;
    if (hours == null || hours > 6) {
      silent++;
      const v = byId.get(vid);
      if (v) add({ severity: "info", token_id: v.token_id, plate: v.plate, name: v.name, text: `${v.plate || v.name}: nessun dato dal sensore ${hours == null ? "ricevuto finora" : `da ${Math.round(hours)} ore`}` });
    }
  }

  const rank = { alta: 0, media: 1, info: 2 } as const;
  attention.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return NextResponse.json({
    manage: true,
    kpis: {
      vehicles: vehicles.length,
      with_data: recent.rowCount ?? 0,
      contracts_at_risk: rows.filter((r) => r.risk === "critico" || r.risk === "attenzione").length,
      deadlines_60d: deadlineIds.size,
      sensors_silent: silent,
    },
    contracts: rows,
    without_contract: vehicles.length - rows.length,
    attention: attention.slice(0, 12),
  });
}
