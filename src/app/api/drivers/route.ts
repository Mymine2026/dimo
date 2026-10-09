import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, listAccessibleVehicles, canManage } from "@/lib/access";

// Vehicles the caller manages, with the current driver, the latest past assignments and the
// drivers (role "user") of the same companies that can be assigned.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const vehicles = await listAccessibleVehicles(user);
  const ids = vehicles.map((v) => v.id);
  const companyIds = [...new Set(vehicles.map((v) => v.company_id).filter((c): c is number => c != null))];

  const [assignments, drivers] = await Promise.all([
    ids.length
      ? pool.query(
          `SELECT a.id, a.vehicle_id, a.user_id, a.start_at, a.end_at, u.email
             FROM vehicle_assignments a JOIN users u ON u.id = a.user_id
            WHERE a.vehicle_id = ANY($1)
            ORDER BY a.start_at DESC`,
          [ids]
        )
      : { rows: [] },
    companyIds.length
      ? pool.query(
          "SELECT id, email, company_id FROM users WHERE role = 'user' AND company_id = ANY($1) ORDER BY email",
          [companyIds]
        )
      : { rows: [] },
  ]);

  return NextResponse.json({
    vehicles: vehicles.map((v) => {
      const mine = assignments.rows.filter((a) => a.vehicle_id === v.id);
      return {
        ...v,
        current: mine.find((a) => a.end_at == null) ?? null,
        history: mine.filter((a) => a.end_at != null).slice(0, 5),
      };
    }),
    drivers: drivers.rows,
  });
}
