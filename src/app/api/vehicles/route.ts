import { NextResponse } from "next/server";
import { queryIdentity } from "@/lib/dimo";

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

// GET /api/vehicles — returns all vehicles across all configured wallets
// Optional ?owner=0x... to query a specific address instead
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const singleOwner = searchParams.get("owner");

  try {
    if (singleOwner) {
      const nodes = await fetchVehiclesForOwner(singleOwner);
      return NextResponse.json(nodes);
    }

    // Query all configured wallets in parallel
    const results = await Promise.all(OWNER_ADDRESSES.map(fetchVehiclesForOwner));
    const allVehicles = results.flat();
    return NextResponse.json(allVehicles);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
