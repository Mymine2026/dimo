import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "super_admin") return null;
  return session;
}

export async function GET() {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT
      v.id,
      v.token_id,
      v.name,
      v.plate,
      v.company_id,
      v.created_at,
      c.name AS company_name,
      COALESCE(
        json_agg(
          json_build_object('id', u.id, 'email', u.email)
          ORDER BY u.email
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'::json
      ) AS users
    FROM vehicles v
    LEFT JOIN companies c ON c.id = v.company_id
    LEFT JOIN vehicle_users vu ON vu.vehicle_id = v.id
    LEFT JOIN users u ON u.id = vu.user_id
    GROUP BY v.id, c.name
    ORDER BY v.created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { token_id, name, plate, company_id, user_ids } = await req.json();
  if (!token_id) return NextResponse.json({ error: "token_id obbligatorio" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "nome obbligatorio" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO vehicles (token_id, name, plate, company_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [Number(token_id), name.trim(), plate?.trim() ?? null, company_id ?? null]
    );
    const vehicle = rows[0];
    if (Array.isArray(user_ids)) {
      for (const uid of user_ids) {
        await client.query(
          "INSERT INTO vehicle_users (vehicle_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [vehicle.id, Number(uid)]
        );
      }
    }
    await client.query("COMMIT");
    return NextResponse.json(vehicle, { status: 201 });
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      return NextResponse.json({ error: "token_id già presente" }, { status: 409 });
    throw e;
  } finally {
    client.release();
  }
}

export async function DELETE(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });
  await pool.query("DELETE FROM vehicles WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
