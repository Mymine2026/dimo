import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW()");
    return NextResponse.json({ now: result.rows[0].now });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
