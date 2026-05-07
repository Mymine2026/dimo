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
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { email, role, company_id, password } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email obbligatoria" }, { status: 400 });
  }

  if (password) {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `UPDATE users SET email=$1, role=$2, company_id=$3, password_hash=$4
       WHERE id=$5
       RETURNING id, email, role, company_id, created_at`,
      [email.trim(), role ?? "user", company_id ?? null, hash, id]
    );
    if (!rows.length) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    return NextResponse.json(rows[0]);
  }

  const { rows } = await pool.query(
    `UPDATE users SET email=$1, role=$2, company_id=$3
     WHERE id=$4
     RETURNING id, email, role, company_id, created_at`,
    [email.trim(), role ?? "user", company_id ?? null, id]
  );
  if (!rows.length) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
