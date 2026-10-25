import pool from "@/lib/db";

// Consumo dati delle SIM dei sensori. Il ricevitore conta i byte che passano sul collegamento TCP;
// qui si aggiungono le intestazioni IP/TCP e i collegamenti per avvicinarsi al conteggio dell'operatore.
// È una STIMA: il dato esatto è quello dell'operatore (può differire di qualche punto percentuale).

export const DEFAULT_ALLOWANCE_BYTES = 1_000_000_000; // 1 GB (decimale, come lo contano gli operatori)
export const PACKET_OVERHEAD = 120;     // intestazioni IP/TCP di dati, ACK del server e ACK del sensore
export const CONNECTION_OVERHEAD = 320; // apertura e chiusura del collegamento TCP
export const OTHER_DAILY_BYTES = 30_000; // DMP del costruttore (2 collegamenti al giorno), NTP e servizi vari: stima

// ─── date (giorno di Roma, formato YYYY-MM-DD) ───────────────────────────────

export function romeToday(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(now);
}

export function romeHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(now));
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addMonths(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, last);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function diffDays(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

// Mese di consumo: parte dal primo giorno di utilizzo (T0) e dura un mese; `end` è escluso.
export function cycleFor(start: string, today: string): { start: string; end: string } {
  const a = parts(start);
  const b = parts(today);
  let k = (b.y - a.y) * 12 + (b.m - a.m);
  if (k < 0) k = 0;
  if (today < addMonths(start, k)) k -= 1;
  if (k < 0) k = 0;
  return { start: addMonths(start, k), end: addMonths(start, k + 1) };
}

// ─── riepilogo per sensore ───────────────────────────────────────────────────

export interface DayUsage {
  day: string;
  bytes: number;
  packets: number;
  connections: number;
}

export interface UsageSummary {
  imei: string;
  usage_start: string;
  cycle_start: string;
  cycle_end: string;
  allowance_bytes: number;
  used_bytes: number;
  percent: number;
  today_bytes: number;
  projected_bytes: number | null;
  days_left: number;
  days: DayUsage[];
}

export interface DeviceRef {
  imei: string | number;
  usage_start: string | null;
  allowance_bytes: string | number;
}

export function alertFor(percent: number): string | null {
  if (percent >= 100) return "oltre";
  if (percent >= 80) return "vicino";
  return null;
}

export async function usageSummary(dev: DeviceRef, today: string): Promise<UsageSummary | null> {
  if (!dev.usage_start) return null;
  const cycle = cycleFor(dev.usage_start, today);
  const allowance = Number(dev.allowance_bytes);

  const { rows } = await pool.query<{ day: string; est_bytes: string; packets: number; connections: number }>(
    `SELECT day::text AS day, est_bytes, packets, connections
       FROM device_usage
      WHERE imei = $1 AND day >= $2 AND day < $3
      ORDER BY day`,
    [dev.imei, cycle.start, cycle.end]
  );

  const days: DayUsage[] = rows.map((r) => ({
    day: r.day,
    bytes: Number(r.est_bytes) + (r.packets > 0 ? OTHER_DAILY_BYTES : 0),
    packets: r.packets,
    connections: r.connections,
  }));

  const used = days.reduce((s, d) => s + d.bytes, 0);
  const elapsed = Math.max(1, diffDays(cycle.start, today) + 1);
  const total = diffDays(cycle.start, cycle.end);
  const todayRow = days.find((d) => d.day === today);

  return {
    imei: String(dev.imei),
    usage_start: dev.usage_start,
    cycle_start: cycle.start,
    cycle_end: cycle.end,
    allowance_bytes: allowance,
    used_bytes: used,
    percent: Math.round((used / allowance) * 1000) / 10,
    today_bytes: todayRow?.bytes ?? 0,
    projected_bytes: elapsed >= 2 ? Math.round((used / elapsed) * total) : null,
    days_left: Math.max(0, diffDays(today, cycle.end)),
    days,
  };
}
