import { NextResponse } from "next/server";
import { getDeveloperJwt, getVehicleJwt, TELEMETRY_API } from "@/lib/dimo";

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = parseInt(searchParams.get("tokenId") ?? "189019");

  try {
    const devJwt = await getDeveloperJwt();
    const devPayload = decodeJwtPayload(devJwt);

    const vehicleJwt = await getVehicleJwt(devJwt, tokenId);
    const vehiclePayload = decodeJwtPayload(vehicleJwt ?? "");

    // Try a minimal telemetry query
    const minimalQuery = `query { signals(tokenId: ${tokenId}, interval: "1h", from: "2026-01-01T00:00:00Z", to: "2026-04-28T23:59:59Z") { timestamp speed(agg: LAST) } }`;
    const res = await fetch(`${TELEMETRY_API}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${vehicleJwt}`,
      },
      body: JSON.stringify({ query: minimalQuery }),
    });
    const telemetryRaw = await res.json();

    return NextResponse.json({
      devJwtPayload: devPayload,
      vehicleJwt: vehicleJwt ? `${vehicleJwt.slice(0, 40)}...` : null,
      vehicleJwtPayload: vehiclePayload,
      telemetryStatus: res.status,
      telemetryResult: telemetryRaw,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
