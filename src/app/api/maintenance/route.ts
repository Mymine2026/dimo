import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { role?: string; user_id?: string };
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId richiesto" }, { status: 400 });

  const { rows: vRows } = await pool.query(
    "SELECT id FROM vehicles WHERE token_id = $1 LIMIT 1",
    [Number(tokenId)]
  );
  if (!vRows.length) return NextResponse.json([]);

  const { rows } = await pool.query(
    `SELECT * FROM maintenance WHERE vehicle_id = $1 ORDER BY created_at DESC`,
    [vRows[0].id]
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tokenId, type, date, km_at_service, next_service_km, notes } = await req.json();
  if (!tokenId) return NextResponse.json({ error: "tokenId richiesto" }, { status: 400 });
  if (!type)    return NextResponse.json({ error: "type obbligatorio" },  { status: 400 });

  const { rows: vRows } = await pool.query(
    "SELECT id FROM vehicles WHERE token_id = $1 LIMIT 1",
    [Number(tokenId)]
  );
  if (!vRows.length) {
    return NextResponse.json(
      { error: "Veicolo non trovato nel sistema. Aggiungilo prima dal pannello Admin." },
      { status: 404 }
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO maintenance (vehicle_id, type, date, km_at_service, next_service_km, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      vRows[0].id,
      type,
      date ?? null,
      km_at_service != null ? Number(km_at_service) : null,
      next_service_km != null ? Number(next_service_km) : null,
      notes?.trim() || null,
    ]
  );
  return NextResponse.json(rows[0], { status: 201 });
}
