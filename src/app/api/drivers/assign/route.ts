import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, listAccessibleVehicles, canManage } from "@/lib/access";

// Assigns a driver to a vehicle from now on (user_id null = nobody). The previous open assignment is
// closed, and the driver's access to the vehicle follows the assignment: the new driver gains it and
// the previous one loses it, so a driver only sees the vehicle they currently have.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Record<string, unknown>;
  const vehicleId = Number(body.vehicle_id);
  const newUserId = body.user_id === null || body.user_id === undefined || body.user_id === "" ? null : Number(body.user_id);

  const vehicle = (await listAccessibleVehicles(user)).find((v) => v.id === vehicleId);
  if (!vehicle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (newUserId != null) {
    const { rows } = await pool.query("SELECT id, role, company_id FROM users WHERE id = $1", [newUserId]);
    const driver = rows[0];
    if (!driver || driver.role !== "user" || driver.company_id !== vehicle.company_id) {
      return NextResponse.json({ error: "Autista non valido per questo veicolo" }, { status: 400 });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: open } = await client.query(
      "SELECT id, user_id FROM vehicle_assignments WHERE vehicle_id = $1 AND end_at IS NULL FOR UPDATE",
      [vehicleId]
    );
    const current = open[0];

    if (current && current.user_id === newUserId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: true, unchanged: true });
    }

    if (current) {
      // end_at must be after start_at: guard against an assignment created in the same instant
      await client.query(
        "UPDATE vehicle_assignments SET end_at = GREATEST(NOW(), start_at + interval '1 second') WHERE id = $1",
        [current.id]
      );
      await client.query("DELETE FROM vehicle_users WHERE vehicle_id = $1 AND user_id = $2", [vehicleId, current.user_id]);
    }
    if (newUserId != null) {
      await client.query(
        "INSERT INTO vehicle_assignments (vehicle_id, user_id, created_by) VALUES ($1,$2,$3)",
        [vehicleId, newUserId, user.userId]
      );
      await client.query(
        "INSERT INTO vehicle_users (vehicle_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [vehicleId, newUserId]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
