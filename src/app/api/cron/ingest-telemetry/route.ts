import { NextResponse } from "next/server";
import { getLatestSignals, sanitizeError } from "@/lib/dimo";
import pool from "@/lib/db";

export const maxDuration = 60;

interface LatestSignals {
  speed?: number;
  powertrainFuelSystemRelativeLevel?: number;
  powertrainCombustionEngineSpeed?: number;
  powertrainCombustionEngineECT?: number;
  powertrainTransmissionTravelledDistance?: number;
  lowVoltageBatteryCurrentVoltage?: number;
  isIgnitionOn?: boolean;
  currentLocationCoordinates?: { timestamp: string; latitude: number; longitude: number };
}

// Polled every 5 minutes by a VPS cron job — pulls the latest DIMO signals for
// every known vehicle and stores one row per vehicle into `telemetry`.
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows: vehicles } = await pool.query<{ id: number; token_id: number }>(
    "SELECT id, token_id FROM vehicles"
  );

  let inserted = 0;
  let skipped = 0;
  const errors: { tokenId: number; error: string }[] = [];

  for (const vehicle of vehicles) {
    try {
      const signals = await getLatestSignals(vehicle.token_id) as LatestSignals | null;
      if (!signals) { skipped++; continue; }

      const loc = signals.currentLocationCoordinates;
      const recordedAt = loc?.timestamp ?? new Date().toISOString();

      const { rowCount } = await pool.query(
        `INSERT INTO telemetry
           (vehicle_id, recorded_at, latitude, longitude, speed, odometer_km,
            fuel_level, engine_rpm, coolant_temp, battery_voltage, ignition_on, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (vehicle_id, recorded_at) DO NOTHING`,
        [
          vehicle.id,
          recordedAt,
          loc?.latitude ?? null,
          loc?.longitude ?? null,
          signals.speed ?? null,
          signals.powertrainTransmissionTravelledDistance ?? null,
          signals.powertrainFuelSystemRelativeLevel ?? null,
          signals.powertrainCombustionEngineSpeed ?? null,
          signals.powertrainCombustionEngineECT ?? null,
          signals.lowVoltageBatteryCurrentVoltage ?? null,
          signals.isIgnitionOn ?? null,
          JSON.stringify(signals),
        ]
      );
      if (rowCount) inserted++; else skipped++;
    } catch (err) {
      errors.push({ tokenId: vehicle.token_id, error: sanitizeError(err) });
    }
  }

  return NextResponse.json({ inserted, skipped, errors });
}
