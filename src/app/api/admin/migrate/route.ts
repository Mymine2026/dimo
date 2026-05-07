import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id         SERIAL PRIMARY KEY,
      token_id   INTEGER NOT NULL,
      name       VARCHAR(255) NOT NULL,
      plate      VARCHAR(50),
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicle_users (
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id)    ON DELETE CASCADE,
      PRIMARY KEY (vehicle_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS admin_vehicles (
      id         SERIAL PRIMARY KEY,
      token_id   TEXT NOT NULL UNIQUE,
      name       TEXT,
      plate      TEXT,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      user_id    INTEGER REFERENCES users(id)     ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id         SERIAL PRIMARY KEY,
      vehicle_id INTEGER REFERENCES admin_vehicles(id) ON DELETE SET NULL,
      vehicle_dimo_token TEXT,
      user_id    INTEGER REFERENCES users(id)          ON DELETE SET NULL,
      company_id INTEGER REFERENCES companies(id)      ON DELETE SET NULL,
      name       VARCHAR(255) NOT NULL,
      type       VARCHAR(50) DEFAULT 'other',
      notes      TEXT,
      file_url   TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  return NextResponse.json({ ok: true });
}
