import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const email    = searchParams.get("email");
  const password = searchParams.get("password");

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password query params" }, { status: 400 });
  }

  const result: Record<string, unknown> = { email, step: null, error: null };

  let row: { id: number; email: string; password_hash: string; role: string; company_id: number | null } | null = null;

  try {
    result.step = "db_query";
    const { rows, rowCount } = await pool.query(
      "SELECT id, email, password_hash, role, company_id FROM users WHERE email = $1",
      [email]
    );
    result.rowCount = rowCount;

    if (!rowCount || rowCount === 0) {
      result.userFound = false;
      return NextResponse.json(result);
    }

    row = rows[0];
    result.userFound   = true;
    result.userId      = row!.id;
    result.role        = row!.role;
    result.companyId   = row!.company_id;
    result.hashPrefix  = row!.password_hash?.slice(0, 7) ?? null;
    result.hashLength  = row!.password_hash?.length ?? 0;
  } catch (e) {
    result.error = String(e);
    result.step  = "db_error";
    return NextResponse.json(result, { status: 500 });
  }

  try {
    result.step = "bcrypt_compare";
    const match = await bcrypt.compare(password, row!.password_hash);
    result.passwordMatch = match;
  } catch (e) {
    result.error = String(e);
    result.step  = "bcrypt_error";
    return NextResponse.json(result, { status: 500 });
  }

  result.step = "done";
  return NextResponse.json(result);
}
