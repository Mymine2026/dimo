import { NextResponse } from "next/server";
import { getLatestSignals, sanitizeError } from "@/lib/dimo";
import { deriveSpeedKmh, pickSpeed } from "@/lib/speed";
import { requireVehicleAccess } from "@/lib/access";
import pool from "@/lib/db";

const FRESH_MS = 10 * 60 * 1000; // reuse a stored telemetry row if newer than this
const SPEED_GAP_MS = 15 * 60 * 1000; // max distance between the two rows used to estimate speed

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  const denied = await requireVehicleAccess(tokenId);
  if (denied) return denied;

  // Prefer a recent locally-stored row (fast, no DIMO round-trip) before falling
  // back to a live DIMO call. `raw` is stored in the exact shape getLatestSignals
  // returns, so this stays a drop-in replacement for the frontend.
  try {
    const { rows } = await pool.query(
      `SELECT t.raw, t.recorded_at, t.odometer_km
         FROM telemetry t
         JOIN vehicles v ON v.id = t.vehicle_id
        WHERE v.token_id = $1
        ORDER BY t.recorded_at DESC
        LIMIT 2`,
      [Number(tokenId)]
    );
    const [row, prev] = rows;
    if (row && Date.now() - new Date(row.recorded_at).getTime() < FRESH_MS) {
      // Some sources (IVECO) report ~0 km/h while driving: estimate from the odometer delta.
      const derived = prev
        ? deriveSpeedKmh(
            { odometerKm: prev.odometer_km, timestamp: prev.recorded_at },
            { odometerKm: row.odometer_km, timestamp: row.recorded_at },
            SPEED_GAP_MS
          )
        : null;
      const reported = typeof row.raw?.speed === "number" ? row.raw.speed : null;
      const speed = pickSpeed(reported, derived);
      return NextResponse.json({
        ...row.raw,
        speed,
        ...(speed !== reported ? { speedEstimated: true } : {}),
      });
    }
  } catch {
    // DB unavailable or vehicle not in `vehicles` yet — fall through to live DIMO call
  }

  try {
    const flattened = await getLatestSignals(parseInt(tokenId));
    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
