import { NextResponse } from "next/server";
import { getDeveloperJwt, getVehicleJwt, queryTelemetry, sanitizeError } from "@/lib/dimo";

// Uses the Telemetry API with agg: LAST over 90 days to get the last known value
// for every signal, regardless of when it was last recorded.
const LATEST_QUERY = `
  query GetLatestSignals($tokenId: Int!, $from: Time!, $to: Time!) {
    signals(tokenId: $tokenId, interval: "90d", from: $from, to: $to) {
      timestamp
      speed(agg: LAST)
      powertrainFuelSystemRelativeLevel(agg: LAST)
      powertrainFuelSystemAbsoluteLevel(agg: LAST)
      powertrainCombustionEngineSpeed(agg: LAST)
      powertrainCombustionEngineECT(agg: LAST)
      powertrainCombustionEngineDieselExhaustFluidLevel(agg: LAST)
      powertrainCombustionEngineTPS(agg: LAST)
      powertrainTransmissionTravelledDistance(agg: LAST)
      lowVoltageBatteryCurrentVoltage(agg: LAST)
      exteriorAirTemperature(agg: LAST)
      isIgnitionOn(agg: LAST)
      obdStatusDTCCount(agg: LAST)
      currentLocationCoordinates(agg: LAST) { latitude longitude }
    }
  }
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  const to   = new Date().toISOString();
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const devJwt     = await getDeveloperJwt();
    const vehicleJwt = await getVehicleJwt(devJwt, parseInt(tokenId));
    const data = await queryTelemetry<{ signals: Record<string, number | null>[] | null }>(
      vehicleJwt, LATEST_QUERY, { tokenId: parseInt(tokenId), from, to }
    );
    // signals returns a single row when interval = range; take the first
    const row = data?.signals?.[0] ?? null;
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
