import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as { role?: string; company_id?: number; user_id?: string };
  return {
    id: u.user_id ? parseInt(u.user_id) : null,
    company_id: u.company_id ?? null,
  };
}

export async function GET() {
  const user = await getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER REFERENCES admin_vehicles(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'other',
      notes TEXT,
      file_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const [docsResult, vehiclesResult] = await Promise.all([
    pool.query(`
      SELECT d.*, v.name AS vehicle_name, v.token_id AS vehicle_token_id
      FROM documents d
      LEFT JOIN admin_vehicles v ON v.id = d.vehicle_id
      WHERE d.user_id = $1 OR (d.company_id IS NOT NULL AND d.company_id = $2)
      ORDER BY d.created_at DESC
    `, [user.id, user.company_id]),
    pool.query(`
      SELECT id, token_id, name, plate
      FROM admin_vehicles
      WHERE user_id = $1 OR (company_id IS NOT NULL AND company_id = $2)
      ORDER BY COALESCE(name, token_id) ASC
    `, [user.id, user.company_id]),
  ]);

  return NextResponse.json({ documents: docsResult.rows, vehicles: vehiclesResult.rows });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vehicle_id, name, type, notes, file_url } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });

  const { rows } = await pool.query(`
    INSERT INTO documents (vehicle_id, user_id, company_id, name, type, notes, file_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
  `, [
    vehicle_id ? Number(vehicle_id) : null,
    user.id,
    user.company_id,
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
