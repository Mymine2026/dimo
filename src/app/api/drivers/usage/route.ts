import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, listAccessibleVehicles, canManage } from "@/lib/access";

const localFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hourCycle: "h23",
  hour: "numeric",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localParts(d: Date) {
  const p = Object.fromEntries(localFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), weekday: p.weekday, day: `${p.year}-${p.month}-${p.day}` };
}

interface Agg {
  vehicle_id: number;
  user_id: number | null;
  email: string | null;
  km: number;
  offKm: number;
  days: Set<string>;
  speedSum: number;
  speedN: number;
}

// Kilometres per vehicle and driver over the last N days. The km between two consecutive stored
// readings (odometer delta) are attributed to the driver assigned at the later reading.
// "Off hours" = 21:00-06:00 or Sunday (Europe/Rome).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(asked) ? asked : 30;

  const vehicles = await listAccessibleVehicles(user);
  const ids = vehicles.map((v) => v.id);
  if (!ids.length) return NextResponse.json({ days, rows: [] });

  const from = new Date(Date.now() - days * 86_400_000);
  const [tel, asg] = await Promise.all([
    pool.query(
      `SELECT vehicle_id, recorded_at, odometer_km FROM telemetry
        WHERE vehicle_id = ANY($1) AND recorded_at >= $2 AND odometer_km IS NOT NULL
        ORDER BY vehicle_id, recorded_at`,
      [ids, from]
    ),
    pool.query(
      `SELECT a.vehicle_id, a.user_id, a.start_at, a.end_at, u.email
         FROM vehicle_assignments a JOIN users u ON u.id = a.user_id
        WHERE a.vehicle_id = ANY($1) AND (a.end_at IS NULL OR a.end_at >= $2)`,
      [ids, from]
    ),
  ]);

  const aggs = new Map<string, Agg>();
  let prev: { vehicle_id: number; at: Date; odo: number } | null = null;

  for (const r of tel.rows) {
    const cur = { vehicle_id: r.vehicle_id as number, at: new Date(r.recorded_at), odo: Number(r.odometer_km) };
    if (prev && prev.vehicle_id === cur.vehicle_id) {
      const dKm = cur.odo - prev.odo;
      const dtMin = (cur.at.getTime() - prev.at.getTime()) / 60_000;
      if (dKm >= 0.5 && dKm <= 500 && dtMin > 0) {
        const a = asg.rows.find(
          (x) => x.vehicle_id === cur.vehicle_id && new Date(x.start_at) <= cur.at && (x.end_at == null || cur.at < new Date(x.end_at))
        );
        const key = `${cur.vehicle_id}:${a?.user_id ?? 0}`;
        let agg = aggs.get(key);
        if (!agg) {
          agg = {
            vehicle_id: cur.vehicle_id,
            user_id: a?.user_id ?? null,
            email: a?.email ?? null,
            km: 0, offKm: 0, days: new Set(), speedSum: 0, speedN: 0,
          };
          aggs.set(key, agg);
        }
        const lp = localParts(cur.at);
        agg.km += dKm;
        if (lp.hour < 6 || lp.hour >= 21 || lp.weekday === "Sun") agg.offKm += dKm;
        agg.days.add(lp.day);
        if (dtMin <= 15) {
          const kmh = dKm / (dtMin / 60);
          if (kmh < 200) { agg.speedSum += kmh; agg.speedN += 1; }
        }
      }
    }
    prev = cur;
  }

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const rows = [...aggs.values()]
    .map((a) => ({
      vehicle_id: a.vehicle_id,
      vehicle_name: vehicleById.get(a.vehicle_id)?.name ?? "",
      plate: vehicleById.get(a.vehicle_id)?.plate ?? null,
      user_id: a.user_id,
      email: a.email,
      km: Math.round(a.km),
      days: a.days.size,
      off_hours_km: Math.round(a.offKm),
      avg_speed: a.speedN ? Math.round(a.speedSum / a.speedN) : null,
    }))
    .sort((x, y) => x.vehicle_name.localeCompare(y.vehicle_name) || y.km - x.km);

  return NextResponse.json({ days, rows });
}
