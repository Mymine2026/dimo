import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { canManage, getSessionUser, listAccessibleVehicles } from "@/lib/access";
import { romeToday, usageSummary } from "@/lib/sim-usage";

// Consumo dati delle SIM dei sensori, per veicolo: mese di utilizzo in corso, % della soglia,
// andamento giornaliero e chiusure di fine giornata. Solo per chi gestisce i veicoli.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const vehicles = await listAccessibleVehicles(user);
  const ids = vehicles.map((v) => v.id);
  if (ids.length === 0) return NextResponse.json({ devices: [] });

  const { rows: devices } = await pool.query<{
    imei: string; label: string | null; vehicle_id: number; usage_start: string | null;
    allowance_bytes: string; last_seen_at: string | null;
  }>(
    `SELECT imei::text AS imei, label, vehicle_id, usage_start::text AS usage_start,
            allowance_bytes::text AS allowance_bytes, last_seen_at
       FROM devices WHERE enabled AND vehicle_id = ANY($1) ORDER BY vehicle_id, imei`,
    [ids]
  );

  const today = romeToday();
  const out = [];
  for (const d of devices) {
    const summary = await usageSummary(d, today);
    const { rows: reports } = await pool.query<{ day: string; day_bytes: string; cycle_bytes: string; percent: string; alert: string | null }>(
      `SELECT day::text AS day, day_bytes::text AS day_bytes, cycle_bytes::text AS cycle_bytes, percent::text AS percent, alert
         FROM device_usage_reports WHERE imei = $1 ORDER BY day DESC LIMIT 14`,
      [d.imei]
    );
    const v = vehicles.find((x) => x.id === d.vehicle_id);
    out.push({
      imei: d.imei,
      label: d.label,
      vehicle_name: v?.name ?? "",
      plate: v?.plate ?? null,
      last_seen_at: d.last_seen_at,
      summary,
      reports: reports.map((r) => ({
        day: r.day,
        day_bytes: Number(r.day_bytes),
        cycle_bytes: Number(r.cycle_bytes),
        percent: Number(r.percent),
        alert: r.alert,
      })),
    });
  }

  return NextResponse.json({ today, devices: out });
}
