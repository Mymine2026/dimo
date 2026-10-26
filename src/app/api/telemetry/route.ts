import { NextResponse } from "next/server";
import { requireVehicleAccess } from "@/lib/access";
import { getDeveloperJwt, getVehicleJwt, queryTelemetry, sanitizeError } from "@/lib/dimo";
import pool from "@/lib/db";

export const maxDuration = 45;

function intervalForHours(hours: number): string {
  if (hours <= 24)  return "10m";
  if (hours <= 168) return "1h";
  if (hours <= 720) return "6h";
  return "12h";
}

// Full query — used by the vehicle detail page (needs all sensor fields)
const TELEMETRY_QUERY = `
  query GetVehicleSignals($tokenId: Int!, $interval: String!, $from: Time!, $to: Time!) {
    signals(tokenId: $tokenId, interval: $interval, from: $from, to: $to) {
      timestamp
      speed(agg: AVG)
      speedMax: speed(agg: MAX)
      fuelLevel: powertrainFuelSystemRelativeLevel(agg: AVG)
      fuelAbsolute: powertrainFuelSystemAbsoluteLevel(agg: LAST)
      range: powertrainRange(agg: LAST)
      location: currentLocationCoordinates(agg: LAST) {
        latitude
        longitude
      }
      engineRpm: powertrainCombustionEngineSpeed(agg: AVG)
      engineCoolantTemp: powertrainCombustionEngineECT(agg: AVG)
      throttle: powertrainCombustionEngineTPS(agg: AVG)
      adBlue: powertrainCombustionEngineDieselExhaustFluidLevel(agg: LAST)
      batteryVoltage: lowVoltageBatteryCurrentVoltage(agg: AVG)
      odometer: powertrainTransmissionTravelledDistance(agg: LAST)
      exteriorTemp: exteriorAirTemperature(agg: AVG)
      isIgnitionOn(agg: LAST)
      torquePercent: powertrainCombustionEngineTorquePercent(agg: AVG)
      accumulatedConsumption: powertrainFuelSystemAccumulatedConsumption(agg: LAST)
    }
  }
`;

// Slim query — used by analytics page; only trip-detection fields, avoids DIMO timeout on 30d ranges
const TELEMETRY_SLIM_QUERY = `
  query GetVehicleSignalsSlim($tokenId: Int!, $interval: String!, $from: Time!, $to: Time!) {
    signals(tokenId: $tokenId, interval: $interval, from: $from, to: $to) {
      timestamp
      speed(agg: AVG)
      speedMax: speed(agg: MAX)
      location: currentLocationCoordinates(agg: LAST) {
        latitude
        longitude
      }
      odometer: powertrainTransmissionTravelledDistance(agg: LAST)
    }
  }
`;

// "10m" / "1h" / "720h" / "2d" -> secondi (stessa sintassi che usa DIMO)
function intervalSeconds(interval: string): number {
  const m = /^(\d+)(m|h|d)$/.exec(interval);
  if (!m) return 600;
  const n = Number(m[1]);
  return m[2] === "m" ? n * 60 : m[2] === "h" ? n * 3600 : n * 86400;
}

// Veicoli con un sensore registrato (ricezione diretta): i segnali vengono dal nostro database, aggregati
// per intervallo come fa DIMO e nella stessa forma. Prima del primo dato del sensore resta DIMO.
async function localSignals(tokenId: number, from: string, to: string, interval: string) {
  const { rows: dev } = await pool.query(
    "SELECT 1 FROM devices d JOIN vehicles v ON v.id = d.vehicle_id WHERE v.token_id = $1 AND d.enabled LIMIT 1",
    [tokenId]
  );
  if (!dev[0]) return null;

  const { rows: first } = await pool.query<{ t: Date | null }>(
    `SELECT MIN(t.recorded_at) AS t FROM telemetry t JOIN vehicles v ON v.id = t.vehicle_id
      WHERE v.token_id = $1 AND t.raw->>'source' LIKE 'ruptela%'`,
    [tokenId]
  );
  const firstSensor = first[0]?.t ? new Date(first[0].t) : null;
  if (!firstSensor || firstSensor > new Date(to)) return null;

  const step = intervalSeconds(interval);
  const start = firstSensor > new Date(from) ? firstSensor.toISOString() : from;
  const { rows } = await pool.query(
    `SELECT to_timestamp(floor(extract(epoch FROM t.recorded_at) / $4) * $4) AS ts,
            AVG(t.speed) AS speed, MAX(t.speed) AS speed_max, AVG(t.fuel_level) AS fuel,
            AVG(t.engine_rpm) AS rpm, AVG(t.coolant_temp) AS coolant, AVG(t.battery_voltage) AS volt,
            (array_agg(t.odometer_km ORDER BY t.recorded_at DESC) FILTER (WHERE t.odometer_km IS NOT NULL))[1] AS odo,
            (array_agg(t.latitude ORDER BY t.recorded_at DESC) FILTER (WHERE t.latitude IS NOT NULL))[1] AS lat,
            (array_agg(t.longitude ORDER BY t.recorded_at DESC) FILTER (WHERE t.latitude IS NOT NULL))[1] AS lon,
            (array_agg(t.ignition_on ORDER BY t.recorded_at DESC))[1] AS ign
       FROM telemetry t JOIN vehicles v ON v.id = t.vehicle_id
      WHERE v.token_id = $1 AND t.recorded_at BETWEEN $2 AND $3
      GROUP BY 1 ORDER BY 1`,
    [tokenId, start, to, step]
  );

  const num = (v: unknown) => (v == null ? null : Number(v));
  const local = rows.map((r) => ({
    timestamp: new Date(r.ts).toISOString(),
    speed: num(r.speed) != null ? Math.round(num(r.speed)! * 10) / 10 : null,
    speedMax: num(r.speed_max),
    fuelLevel: num(r.fuel) != null ? Math.round(num(r.fuel)! * 10) / 10 : null,
    fuelAbsolute: null,
    range: null,
    location: r.lat != null && r.lon != null ? { latitude: Number(r.lat), longitude: Number(r.lon) } : null,
    engineRpm: num(r.rpm) != null ? Math.round(num(r.rpm)!) : null,
    engineCoolantTemp: num(r.coolant) != null ? Math.round(num(r.coolant)!) : null,
    throttle: null,
    adBlue: null,
    batteryVoltage: num(r.volt) != null ? Math.round(num(r.volt)! * 100) / 100 : null,
    odometer: num(r.odo),
    exteriorTemp: null,
    isIgnitionOn: r.ign == null ? null : r.ign ? 1 : 0,
    torquePercent: null,
    accumulatedConsumption: null,
  }));
  return { local, firstSensor };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  const slim    = searchParams.get("slim") === "1";
  const hoursParam = parseInt(searchParams.get("hours") ?? "720");
  const from = searchParams.get("from") ?? new Date(Date.now() - hoursParam * 60 * 60 * 1000).toISOString();
  const to   = searchParams.get("to")   ?? new Date().toISOString();

  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  const denied = await requireVehicleAccess(tokenId);
  if (denied) return denied;

  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const diffHours = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60);
  const interval = searchParams.get("interval") ?? intervalForHours(diffHours);

  const query = slim ? TELEMETRY_SLIM_QUERY : TELEMETRY_QUERY;

  if (!slim) {
    try {
      const direct = await localSignals(parseInt(tokenId), from, to, interval);
      if (direct) {
        // Parte precedente al primo dato del sensore: ancora da DIMO (se risponde)
        let older: unknown[] = [];
        if (new Date(from).getTime() < direct.firstSensor.getTime() - 3_600_000) {
          try {
            const devJwt     = await getDeveloperJwt();
            const vehicleJwt = await getVehicleJwt(devJwt, parseInt(tokenId));
            const data = await queryTelemetry<{ signals: unknown[] | null }>(vehicleJwt, query, {
              tokenId: parseInt(tokenId), interval, from, to: direct.firstSensor.toISOString(),
            });
            older = data?.signals ?? [];
          } catch { /* solo il sensore diretto: lo storico DIMO è facoltativo */ }
        }
        return NextResponse.json([...older, ...direct.local]);
      }
    } catch (err) {
      console.error("telemetry locale:", err instanceof Error ? err.message : err);
      // se il database locale non risponde si ripiega su DIMO
    }
  }

  try {
    const devJwt     = await getDeveloperJwt();
    const vehicleJwt = await getVehicleJwt(devJwt, parseInt(tokenId));
    const data = await queryTelemetry<{ signals: unknown[] | null }>(vehicleJwt, query, {
      tokenId: parseInt(tokenId),
      interval,
      from,
      to,
    });
    return NextResponse.json(data?.signals ?? []);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
