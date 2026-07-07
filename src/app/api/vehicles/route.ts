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

type DimoVehicle = {
  tokenId: number;
  tokenDID?: string;
  owner?: string;
  mintedAt?: string;
  definition?: { make: string; model: string; year: number } | null;
  syntheticDevice?: { tokenId: number; address: string } | null;
  aftermarketDevice?: { tokenId: number; address: string } | null;
  _source?: "dimo" | "db";
};

type DbVehicleRow = {
  token_id: string;
  name: string;
  plate: string;
  company_id: number | null;
};

const OWNER_ADDRESSES = [
  process.env.DIMO_WALLET_ADDRESS,
  process.env.DIMO_WALLET_ADDRESS_2,
  process.env.DIMO_WALLET_ADDRESS_3,
].filter(Boolean) as string[];

async function fetchVehiclesForOwner(owner: string): Promise<DimoVehicle[]> {
  const data = await queryIdentity<{ vehicles: { nodes: DimoVehicle[] } }>(
    VEHICLES_QUERY,
    { owner }
  );
  return data.vehicles.nodes;
}

function mergeVehicles(dimoVehicles: DimoVehicle[], dbRows: DbVehicleRow[]): DimoVehicle[] {
  const byTokenId = new Map<number, DimoVehicle>();

  for (const v of dimoVehicles) {
    byTokenId.set(Number(v.tokenId), { ...v, _source: "dimo" });
  }

  for (const row of dbRows) {
    const tokenId = Number(row.token_id);
    if (!byTokenId.has(tokenId)) {
      // Vehicle exists in DB but not in DIMO — expose it with DB metadata only
      byTokenId.set(tokenId, {
        tokenId,
        definition: row.name
          ? { make: row.name, model: "", year: 0 }
          : null,
        _source: "db",
      });
    }
  }

  return Array.from(byTokenId.values());
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

  let dimoVehicles: DimoVehicle[];
  try {
    if (singleOwner) {
      dimoVehicles = await fetchVehiclesForOwner(singleOwner);
    } else {
      const results = await Promise.all(OWNER_ADDRESSES.map(fetchVehiclesForOwner));
      dimoVehicles = results.flat();
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  if (role === "super_admin") {
    const { rows: allDbRows } = await pool.query<DbVehicleRow>(
      "SELECT token_id, name, plate, company_id FROM vehicles"
    );
    // Solo i veicoli registrati in flotta — esclude i mezzi di test presenti
    // sul wallet DIMO ma mai aggiunti alla tabella vehicles (es. BMW X5).
    const allowedTokenIds = new Set(allDbRows.map((r) => Number(r.token_id)));
    const filteredDimo = dimoVehicles.filter((v) => allowedTokenIds.has(Number(v.tokenId)));
    return NextResponse.json(mergeVehicles(filteredDimo, allDbRows));
  }

  let dbRows: DbVehicleRow[];

  if (role === "admin" && companyId) {
    const { rows } = await pool.query<DbVehicleRow>(
      "SELECT token_id, name, plate, company_id FROM vehicles WHERE company_id = $1",
      [companyId]
    );
    dbRows = rows;
  } else {
    if (!userId) return NextResponse.json([]);
    const { rows } = await pool.query<DbVehicleRow>(
      `SELECT v.token_id, v.name, v.plate, v.company_id FROM vehicles v
       JOIN vehicle_users vu ON vu.vehicle_id = v.id
       WHERE vu.user_id = $1`,
      [userId]
    );
    dbRows = rows;
  }

  const allowedTokenIds = new Set(dbRows.map((r) => Number(r.token_id)));
  const filteredDimo = dimoVehicles.filter((v) => allowedTokenIds.has(Number(v.tokenId)));
  return NextResponse.json(mergeVehicles(filteredDimo, dbRows));
}
