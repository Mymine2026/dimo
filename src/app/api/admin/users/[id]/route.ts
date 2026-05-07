import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

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
  const { email, role, company_id, password, vehicle_ids } = await req.json();

  if (!email?.trim()) return NextResponse.json({ error: "Email obbligatoria" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let userRow;
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      const { rows } = await client.query(
        `UPDATE users SET email=$1, role=$2, company_id=$3, password_hash=$4
         WHERE id=$5 RETURNING id, email, role, company_id, created_at`,
        [email.trim(), role ?? "user", company_id ?? null, hash, id]
      );
      userRow = rows[0];
    } else {
      const { rows } = await client.query(
        `UPDATE users SET email=$1, role=$2, company_id=$3
         WHERE id=$4 RETURNING id, email, role, company_id, created_at`,
        [email.trim(), role ?? "user", company_id ?? null, id]
      );
      userRow = rows[0];
    }

    if (!userRow) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    await client.query("DELETE FROM vehicle_users WHERE user_id = $1", [id]);
    if (Array.isArray(vehicle_ids)) {
      for (const vid of vehicle_ids) {
        await client.query(
          "INSERT INTO vehicle_users (vehicle_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [Number(vid), id]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(userRow);
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      return NextResponse.json({ error: "Email già registrata" }, { status: 409 });
    throw e;
  } finally {
    client.release();
  }
}
