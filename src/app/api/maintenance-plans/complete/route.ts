import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, listAccessibleVehicles, canManage } from "@/lib/access";

// "tagliando" and "gomme" keep the lowercase type the Analytics card already reads.
function logType(name: string): string {
  const lower = name.trim().toLowerCase();
  return lower === "tagliando" || lower === "gomme" ? lower : name.trim();
}

// Marks a scheduled maintenance as done: updates the plan baseline and logs the event in `maintenance`.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Record<string, unknown>;
  const planId = Number(body.id);
  const doneDate = typeof body.done_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.done_date)
    ? body.done_date
    : new Date().toISOString().slice(0, 10);
  const doneKmRaw = body.done_km === null || body.done_km === undefined || body.done_km === "" ? null : Number(body.done_km);
  if (doneKmRaw != null && (!Number.isInteger(doneKmRaw) || doneKmRaw < 0)) {
    return NextResponse.json({ error: "Km non validi" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  const ids = (await listAccessibleVehicles(user)).map((v) => v.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id, vehicle_id, name, interval_km FROM maintenance_plans WHERE id = $1 AND vehicle_id = ANY($2) FOR UPDATE",
      [planId, ids]
    );
    const plan = rows[0];
    if (!plan) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 });
    }

    await client.query(
      "UPDATE maintenance_plans SET last_done_km = $2, last_done_date = $3 WHERE id = $1",
      [planId, doneKmRaw, doneDate]
    );
    await client.query(
      `INSERT INTO maintenance (vehicle_id, type, date, km_at_service, next_service_km, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        plan.vehicle_id,
        logType(plan.name),
        doneDate,
        doneKmRaw,
        doneKmRaw != null && plan.interval_km ? doneKmRaw + plan.interval_km : null,
        notes,
      ]
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
