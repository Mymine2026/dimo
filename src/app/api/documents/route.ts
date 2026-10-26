import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";
import { getSessionUser, canAccessVehicle, listAccessibleVehicles } from "@/lib/access";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as { role?: string; company_id?: number; user_id?: string };
  return {
    id: u.user_id ? parseInt(u.user_id) : null,
    company_id: u.company_id ?? null,
  };
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      vehicle_dimo_token TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'other',
      notes TEXT,
      file_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='vehicle_dimo_token'
      ) THEN
        ALTER TABLE documents ADD COLUMN vehicle_dimo_token TEXT;
      END IF;
    END $$;
  `);
}

export async function GET() {
  const user = await getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();

  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Il super admin vede tutto; gli altri i propri documenti, quelli dell'azienda e quelli dei veicoli a cui hanno accesso.
  const accessible = await listAccessibleVehicles(me);
  const ids = accessible.map((v) => v.id);
  const docsResult = await pool.query(`
      SELECT d.*,
        v.name AS vehicle_name,
        v.token_id::text AS vehicle_token_id,
        COALESCE(v.name, v.token_id::text, d.vehicle_dimo_token) AS vehicle_display
      FROM documents d
      LEFT JOIN vehicles v ON v.id = d.vehicle_id
      WHERE $3::boolean
         OR d.user_id = $1
         OR (d.company_id IS NOT NULL AND d.company_id = $2)
         OR d.vehicle_id = ANY($4::int[])
      ORDER BY d.created_at DESC
    `, [user.id, user.company_id, me.role === "super_admin", ids]);

  const vehicles = accessible.map((v) => ({
    id: v.id, token_id: String(v.token_id), name: v.name, plate: v.plate,
  }));
  return NextResponse.json({ documents: docsResult.rows, vehicles });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();

  const { vehicle_id, vehicle_dimo_token, name, type, notes, file_url } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });

  let resolvedVehicleId: number | null = vehicle_id ? Number(vehicle_id) : null;
  const resolvedDimoToken: string | null = vehicle_dimo_token?.trim() || null;
  let vehicleCompanyId: number | null = null;

  // Veicolo registrato in flotta: si collega per id o per token e si controlla che l'utente possa vederlo.
  if (resolvedVehicleId || (resolvedDimoToken && /^-?d+$/.test(resolvedDimoToken))) {
    const { rows } = await pool.query(
      "SELECT id, token_id, company_id FROM vehicles WHERE id = $1 OR token_id = $2 LIMIT 1",
      [resolvedVehicleId, resolvedDimoToken && /^-?d+$/.test(resolvedDimoToken) ? Number(resolvedDimoToken) : null]
    );
    if (rows.length > 0) {
      const me = await getSessionUser();
      if (!me || !(await canAccessVehicle(me, rows[0].token_id))) {
        return NextResponse.json({ error: "Veicolo non accessibile" }, { status: 403 });
      }
      resolvedVehicleId = rows[0].id;
      vehicleCompanyId = rows[0].company_id;
    }
  }

  const { rows } = await pool.query(`
    INSERT INTO documents (vehicle_id, vehicle_dimo_token, user_id, company_id, name, type, notes, file_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [
    resolvedVehicleId,
    resolvedDimoToken,
    user.id,
    vehicleCompanyId ?? user.company_id,
    name.trim(),
    type ?? "other",
    notes?.trim() || null,
    file_url?.trim() || null,
  ]);

  return NextResponse.json(rows[0], { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

  await pool.query(
    "DELETE FROM documents WHERE id = $1 AND (user_id = $2 OR company_id = $3)",
    [id, user.id, user.company_id]
  );
  return NextResponse.json({ ok: true });
}
