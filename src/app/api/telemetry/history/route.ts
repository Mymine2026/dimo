import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Reads locally-stored telemetry (5-min resolution) instead of querying DIMO live.
// No aggregation-interval limits and no risk of the 30-day-range DIMO timeout.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to   = searchParams.get("to")   ?? new Date().toISOString();

  const { rows } = await pool.query(
    `SELECT t.recorded_at AS timestamp, t.latitude, t.longitude, t.speed,
            t.odometer_km, t.fuel_level, t.engine_rpm, t.coolant_temp,
            t.battery_voltage, t.ignition_on
       FROM telemetry t
       JOIN vehicles v ON v.id = t.vehicle_id
      WHERE v.token_id = $1 AND t.recorded_at BETWEEN $2 AND $3
      ORDER BY t.recorded_at ASC`,
    [Number(tokenId), from, to]
  );

  return NextResponse.json(rows);
}
