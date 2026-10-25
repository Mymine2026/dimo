import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import pool from "@/lib/db";
import { isStationary, mapRuptelaEvent, STATIONARY_MIN_GAP_MS, type RuptelaEvent, type TelemetryRow } from "@/lib/ruptela";
import { CONNECTION_OVERHEAD, PACKET_OVERHEAD } from "@/lib/sim-usage";

export const maxDuration = 30;

const MAX_EVENTS = 500;
const MAX_BYTES = 10_000_000;

function secretOk(received: string | null): boolean {
  const expected = process.env.INGEST_SECRET ?? process.env.CRON_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bytes(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= MAX_BYTES ? Math.round(n) : 0;
}

// Riceve i record dei sensori Ruptela dal ricevitore TCP (che risponde ACK al sensore solo se
// questa chiamata va a buon fine, così il sensore non perde dati e li rinvia).
// Body: { imei, events: [{ time, data: { trigger, pos, signals } }], bytesIn, bytesOut, newConnection }
// bytesIn/bytesOut sono i byte scambiati col sensore per questo pacchetto: servono a stimare il consumo della SIM.
export async function POST(req: Request) {
  if (!secretOk(req.headers.get("x-ingest-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imei?: unknown; events?: unknown; bytesIn?: unknown; bytesOut?: unknown; newConnection?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const imei = Number(body.imei);
  const events = body.events;
  if (!Number.isInteger(imei) || imei <= 0 || !Array.isArray(events)) {
    return NextResponse.json({ error: "imei ed events obbligatori" }, { status: 400 });
  }
  if (events.length > MAX_EVENTS) {
    return NextResponse.json({ error: "Troppi record" }, { status: 413 });
  }

  // Solo i sensori registrati e abilitati: tutti gli altri IMEI vengono rifiutati
  const { rows: dev } = await pool.query<{ vehicle_id: number }>(
    "SELECT vehicle_id FROM devices WHERE imei = $1 AND enabled",
    [imei]
  );
  if (!dev[0]) return NextResponse.json({ error: "Dispositivo non registrato" }, { status: 403 });
  const vehicleId = dev[0].vehicle_id;

  const rows: TelemetryRow[] = [];
  for (const ev of events as RuptelaEvent[]) {
    const r = mapRuptelaEvent(ev, imei);
    if (r) rows.push(r);
  }
  rows.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const { rows: last } = await pool.query<{ t: Date | null }>(
    "SELECT MAX(recorded_at) AS t FROM telemetry WHERE vehicle_id = $1",
    [vehicleId]
  );
  let lastKept = last[0]?.t ? new Date(last[0].t).getTime() : 0;

  const bytesIn = bytes(body.bytesIn);
  const bytesOut = bytes(body.bytesOut);
  const newConn = body.newConnection === true ? 1 : 0;
  const estBytes = bytesIn + bytesOut + PACKET_OVERHEAD + newConn * CONNECTION_OVERHEAD;

  let inserted = 0;
  let skipped = events.length - rows.length;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      const t = r.recordedAt.getTime();
      if (isStationary(r) && t - lastKept < STATIONARY_MIN_GAP_MS && t >= lastKept) {
        skipped++;
        continue;
      }
      const res = await client.query(
        `INSERT INTO telemetry
           (vehicle_id, recorded_at, latitude, longitude, speed, odometer_km,
            fuel_level, engine_rpm, coolant_temp, battery_voltage, ignition_on, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (vehicle_id, recorded_at) DO NOTHING`,
        [
          vehicleId, r.recordedAt, r.latitude, r.longitude, r.speed, r.odometerKm,
          r.fuelLevel, r.engineRpm, r.coolantTemp, r.batteryVoltage, r.ignitionOn, JSON.stringify(r.raw),
        ]
      );
      if (res.rowCount) {
        inserted++;
        if (t > lastKept) lastKept = t;
      } else {
        skipped++;
      }
    }

    // Consumo dati della SIM: il giorno è quello di Roma; il primo giorno di utilizzo (T0) si fissa al primo pacchetto
    await client.query(
      "UPDATE devices SET last_seen_at = NOW(), usage_start = COALESCE(usage_start, (NOW() AT TIME ZONE 'Europe/Rome')::date) WHERE imei = $1",
      [imei]
    );
    await client.query(
      `INSERT INTO device_usage (imei, day, bytes_in, bytes_out, packets, connections, est_bytes)
       VALUES ($1, (NOW() AT TIME ZONE 'Europe/Rome')::date, $2, $3, 1, $4, $5)
       ON CONFLICT (imei, day) DO UPDATE SET
         bytes_in    = device_usage.bytes_in + EXCLUDED.bytes_in,
         bytes_out   = device_usage.bytes_out + EXCLUDED.bytes_out,
         packets     = device_usage.packets + 1,
         connections = device_usage.connections + EXCLUDED.connections,
         est_bytes   = device_usage.est_bytes + EXCLUDED.est_bytes`,
      [imei, bytesIn, bytesOut, newConn, estBytes]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ingest ruptela:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Errore di salvataggio" }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ accepted: true, inserted, skipped });
}
