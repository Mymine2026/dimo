import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "super_admin") return null;
  return session;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { token_id, name, plate, company_id, user_ids } = await req.json();

  if (!token_id) return NextResponse.json({ error: "token_id obbligatorio" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "nome obbligatorio" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE vehicles SET token_id=$1, name=$2, plate=$3, company_id=$4
       WHERE id=$5 RETURNING *`,
      [Number(token_id), name.trim(), plate?.trim() ?? null, company_id ?? null, id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Veicolo non trovato" }, { status: 404 });
    }
    await client.query("DELETE FROM vehicle_users WHERE vehicle_id = $1", [id]);
    if (Array.isArray(user_ids)) {
      for (const uid of user_ids) {
        await client.query(
          "INSERT INTO vehicle_users (vehicle_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [id, Number(uid)]
        );
      }
    }
    await client.query("COMMIT");
    return NextResponse.json(rows[0]);
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      return NextResponse.json({ error: "token_id già presente" }, { status: 409 });
    throw e;
  } finally {
    client.release();
  }
}
