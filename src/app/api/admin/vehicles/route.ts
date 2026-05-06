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
      v.user_id,
      v.created_at,
      c.name AS company_name,
      u.email AS user_email
    FROM admin_vehicles v
    LEFT JOIN companies c ON c.id = v.company_id
    LEFT JOIN users     u ON u.id = v.user_id
    ORDER BY v.created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { token_id, name, plate, company_id, user_id } = await req.json();
  if (!token_id?.trim()) return NextResponse.json({ error: "token_id obbligatorio" }, { status: 400 });

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_vehicles (token_id, name, plate, company_id, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [token_id.trim(), name?.trim() ?? null, plate?.trim() ?? null, company_id ?? null, user_id ?? null]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "token_id già presente" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

  await pool.query("DELETE FROM admin_vehicles WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
