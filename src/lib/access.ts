import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/lib/db";

export interface SessionUser {
  role: string;
  companyId: number | null;
  userId: number | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as { role?: string; company_id?: number | null; user_id?: string };
  return {
    role: u.role ?? "user",
    companyId: u.company_id ?? null,
    userId: u.user_id ? parseInt(u.user_id) : null,
  };
}

// Same visibility rules as /api/vehicles: super_admin sees every registered vehicle,
// an admin sees the vehicles of their company, anyone else only the vehicles assigned to them.
export async function canAccessVehicle(user: SessionUser, tokenId: number): Promise<boolean> {
  if (!Number.isFinite(tokenId)) return false;

  if (user.role === "super_admin") {
    const { rowCount } = await pool.query("SELECT 1 FROM vehicles WHERE token_id = $1", [tokenId]);
    return !!rowCount;
  }

  if (user.role === "admin" && user.companyId) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM vehicles WHERE token_id = $1 AND company_id = $2",
      [tokenId, user.companyId]
    );
    return !!rowCount;
  }

  if (!user.userId) return false;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM vehicles v
       JOIN vehicle_users vu ON vu.vehicle_id = v.id
      WHERE v.token_id = $1 AND vu.user_id = $2`,
    [tokenId, user.userId]
  );
  return !!rowCount;
}

// Returns an error response when the caller is not logged in or cannot see the vehicle, null otherwise.
export async function requireVehicleAccess(tokenId: string | number | null | undefined): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessVehicle(user, Number(tokenId)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export interface FleetVehicle {
  id: number;
  token_id: number;
  name: string;
  plate: string | null;
  company_id: number | null;
}

// Super admin and company admins can edit schedules and assignments; drivers only read.
export function canManage(user: SessionUser): boolean {
  return user.role === "super_admin" || (user.role === "admin" && user.companyId != null);
}

// Vehicles the user may see, with the same rules as canAccessVehicle.
export async function listAccessibleVehicles(user: SessionUser): Promise<FleetVehicle[]> {
  const cols = "v.id, v.token_id, v.name, v.plate, v.company_id";

  if (user.role === "super_admin") {
    const { rows } = await pool.query(`SELECT ${cols} FROM vehicles v ORDER BY v.name`);
    return rows;
  }
  if (user.role === "admin" && user.companyId) {
    const { rows } = await pool.query(
      `SELECT ${cols} FROM vehicles v WHERE v.company_id = $1 ORDER BY v.name`,
      [user.companyId]
    );
    return rows;
  }
  if (!user.userId) return [];
  const { rows } = await pool.query(
    `SELECT ${cols} FROM vehicles v JOIN vehicle_users vu ON vu.vehicle_id = v.id
      WHERE vu.user_id = $1 ORDER BY v.name`,
    [user.userId]
  );
  return rows;
}
