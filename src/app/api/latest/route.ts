import { NextResponse } from "next/server";
import { getLatestSignals, sanitizeError } from "@/lib/dimo";
import pool from "@/lib/db";

const FRESH_MS = 10 * 60 * 1000; // reuse a stored telemetry row if newer than this

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  // Prefer a recent locally-stored row (fast, no DIMO round-trip) before falling
  // back to a live DIMO call. `raw` is stored in the exact shape getLatestSignals
  // returns, so this stays a drop-in replacement for the frontend.
  try {
    const { rows } = await pool.query(
      `SELECT t.raw, t.recorded_at
         FROM telemetry t
         JOIN vehicles v ON v.id = t.vehicle_id
        WHERE v.token_id = $1
        ORDER BY t.recorded_at DESC
        LIMIT 1`,
      [Number(tokenId)]
    );
    const row = rows[0];
    if (row && Date.now() - new Date(row.recorded_at).getTime() < FRESH_MS) {
      return NextResponse.json(row.raw);
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
