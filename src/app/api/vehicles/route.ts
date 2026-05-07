import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { queryIdentity } from "@/lib/dimo";
import pool from "@/lib/db";

const VEHICLES_QUERY = `
  query GetMyVehicles($owner: Address!) {
    vehicles(filterBy: { owner: $owner }, first: 50) {
      nodes {
        tokenId
        tokenDID
        owner
        mintedAt
        definition {
          make
          model
          year
        }
        syntheticDevice {
          tokenId
          address
        }
        aftermarketDevice {
          tokenId
          address
        }
      }
    }
  }
`;

const OWNER_ADDRESSES = [
  process.env.DIMO_WALLET_ADDRESS,
  process.env.DIMO_WALLET_ADDRESS_2,
].filter(Boolean) as string[];

async function fetchVehiclesForOwner(owner: string) {
  const data = await queryIdentity<{ vehicles: { nodes: unknown[] } }>(
    VEHICLES_QUERY,
    { owner }
  );
  return data.vehicles.nodes;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = session.user as { role?: string; company_id?: number; user_id?: string };
  const role = u.role ?? "user";
  const companyId = u.company_id ?? null;
  const userId = u.user_id ? parseInt(u.user_id) : null;

  const { searchParams } = new URL(req.url);
  const singleOwner = searchParams.get("owner");

  let allVehicles: unknown[];
  try {
    if (singleOwner) {
      allVehicles = await fetchVehiclesForOwner(singleOwner);
    } else {
      const results = await Promise.all(OWNER_ADDRESSES.map(fetchVehiclesForOwner));
      allVehicles = results.flat();
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  if (role === "super_admin") {
    return NextResponse.json(allVehicles);
  }

  let allowedTokenIds: Set<number>;

  if (role === "admin" && companyId) {
    const { rows } = await pool.query(
      "SELECT token_id FROM vehicles WHERE company_id = $1",
      [companyId]
    );
    allowedTokenIds = new Set(rows.map((r) => Number(r.token_id)));
  } else {
    if (!userId) return NextResponse.json([]);
    const { rows } = await pool.query(
      `SELECT v.token_id FROM vehicles v
       JOIN vehicle_users vu ON vu.vehicle_id = v.id
       WHERE vu.user_id = $1`,
      [userId]
    );
    allowedTokenIds = new Set(rows.map((r) => Number(r.token_id)));
  }

  const filtered = allVehicles.filter((v) => {
    const tokenId = Number((v as { tokenId: number }).tokenId);
    return allowedTokenIds.has(tokenId);
  });

  return NextResponse.json(filtered);
}
