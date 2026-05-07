import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "super_admin") return null;
  return session;
}

export async function GET() {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT
      u.id,
      u.email,
      u.role,
      u.company_id,
      u.created_at,
      c.name AS company_name,
      COALESCE(
        json_agg(
          json_build_object('id', v.id, 'name', COALESCE(v.name, v.token_id::text), 'token_id', v.token_id)
          ORDER BY v.name
        ) FILTER (WHERE v.id IS NOT NULL),
        '[]'::json
      ) AS vehicles
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    LEFT JOIN vehicle_users vu ON vu.user_id = u.id
    LEFT JOIN vehicles v ON v.id = vu.vehicle_id
    GROUP BY u.id, c.name
    ORDER BY u.created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, password, role, company_id, vehicle_ids } = await req.json();
  if (!email?.trim() || !password)
    return NextResponse.json({ error: "Email e password obbligatorie" }, { status: 400 });

  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, role, company_id)
       VALUES ($1, $2, $3, $4) RETURNING id, email, role, company_id, created_at`,
      [email.trim(), hash, role ?? "user", company_id ?? null]
    );
    const user = rows[0];
    if (Array.isArray(vehicle_ids)) {
      for (const vid of vehicle_ids) {
        await client.query(
          "INSERT INTO vehicle_users (vehicle_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [Number(vid), user.id]
        );
      }
    }
    await client.query("COMMIT");
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      return NextResponse.json({ error: "Email già registrata" }, { status: 409 });
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
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
