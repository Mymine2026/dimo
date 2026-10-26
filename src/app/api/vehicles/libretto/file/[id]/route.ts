import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, canAccessVehicle } from "@/lib/access";

// Copia del libretto: la vede il super admin, l'azienda proprietaria e chi ha accesso al veicolo.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rows } = await pool.query(
    `SELECT f.name, f.mime, f.data, f.company_id, v.token_id
       FROM libretto_files f LEFT JOIN vehicles v ON v.id = f.vehicle_id WHERE f.id = $1`,
    [Number(id)]
  );
  if (!rows.length) return NextResponse.json({ error: "File non trovato" }, { status: 404 });
  const f = rows[0];

  const allowed =
    user.role === "super_admin" ||
    (user.role === "admin" && user.companyId != null && f.company_id === user.companyId) ||
    (f.token_id != null && (await canAccessVehicle(user, f.token_id)));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(f.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
