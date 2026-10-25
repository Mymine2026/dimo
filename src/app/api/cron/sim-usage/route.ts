import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { alertFor, romeHour, romeToday, usageSummary } from "@/lib/sim-usage";

export const maxDuration = 60;

// Chiusura di fine giornata del consumo SIM. La chiama ogni ora una riga di crontab della VPS
// (X-Cron-Secret); agisce solo tra le 23:00 e le 23:59 di Roma (così non dipende dall'ora legale),
// oppure subito con ?force=1. Per ogni sensore registra il consumo del giorno, il cumulato del mese
// di utilizzo e la % sulla soglia (1 GB), con un avviso oltre l'80% e oltre il 100%.
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && romeHour() !== 23) return NextResponse.json({ skipped: true });

  const today = romeToday();
  const { rows: devices } = await pool.query<{ imei: string; usage_start: string | null; allowance_bytes: string }>(
    `SELECT imei::text AS imei, usage_start::text AS usage_start, allowance_bytes::text AS allowance_bytes
       FROM devices WHERE enabled AND usage_start IS NOT NULL AND usage_start <= $1`,
    [today]
  );

  const closed: { imei: string; day: string; day_bytes: number; cycle_bytes: number; percent: number; alert: string | null }[] = [];
  for (const d of devices) {
    const s = await usageSummary(d, today);
    if (!s) continue;
    const alert = alertFor(s.percent);
    await pool.query(
      `INSERT INTO device_usage_reports (imei, day, day_bytes, cycle_bytes, cycle_start, allowance_bytes, percent, alert)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (imei, day) DO UPDATE SET
         day_bytes = EXCLUDED.day_bytes, cycle_bytes = EXCLUDED.cycle_bytes, cycle_start = EXCLUDED.cycle_start,
         allowance_bytes = EXCLUDED.allowance_bytes, percent = EXCLUDED.percent, alert = EXCLUDED.alert, created_at = NOW()`,
      [d.imei, today, s.today_bytes, s.used_bytes, s.cycle_start, s.allowance_bytes, s.percent, alert]
    );
    closed.push({ imei: d.imei, day: today, day_bytes: s.today_bytes, cycle_bytes: s.used_bytes, percent: s.percent, alert });
  }

  return NextResponse.json({ day: today, closed });
}
