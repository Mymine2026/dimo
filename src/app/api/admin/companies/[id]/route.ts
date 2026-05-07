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
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "UPDATE companies SET name=$1 WHERE id=$2 RETURNING *",
    [name.trim(), id]
  );
  if (!rows.length) return NextResponse.json({ error: "Azienda non trovata" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
