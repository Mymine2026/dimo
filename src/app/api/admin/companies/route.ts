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
      COUNT(DISTINCT u.id)::int  AS user_count,
      COUNT(DISTINCT v.id)::int  AS vehicle_count
    FROM companies c
    LEFT JOIN users         u ON u.company_id = c.id
    LEFT JOIN admin_vehicles v ON v.company_id = c.id
    GROUP BY c.id
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
