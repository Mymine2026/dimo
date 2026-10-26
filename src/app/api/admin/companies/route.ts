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
      c.id,
      c.name,
      c.created_at,
      (SELECT COUNT(*)::int FROM users u    WHERE u.company_id = c.id) AS user_count,
      (SELECT COUNT(*)::int FROM vehicles v WHERE v.company_id = c.id) AS vehicle_count,
      COALESCE((SELECT json_agg(json_build_object('id', v.id, 'name', v.name, 'plate', v.plate, 'token_id', v.token_id) ORDER BY v.name)
                  FROM vehicles v WHERE v.company_id = c.id), '[]'::json) AS vehicles,
      COALESCE((SELECT json_agg(json_build_object('id', u.id, 'email', u.email, 'role', u.role) ORDER BY u.email)
                  FROM users u WHERE u.company_id = c.id), '[]'::json) AS users
    FROM companies c
    ORDER BY c.created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });

  const { rows } = await pool.query(
    "INSERT INTO companies (name) VALUES ($1) RETURNING *",
    [name.trim()]
  );
  return NextResponse.json(rows[0], { status: 201 });
}

export async function DELETE(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

  await pool.query("DELETE FROM companies WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
