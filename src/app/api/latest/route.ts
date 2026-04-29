import { NextResponse } from "next/server";
import { getDeveloperJwt, getVehicleJwt, queryTelemetry, sanitizeError } from "@/lib/dimo";

const LATEST_QUERY = `
  query GetLatestSignals($tokenId: Int!) {
    signalsLatest(tokenId: $tokenId) {
      speed { timestamp value }
      powertrainFuelSystemRelativeLevel { timestamp value }
      powertrainFuelSystemAbsoluteLevel { timestamp value }
      powertrainCombustionEngineSpeed { timestamp value }
      powertrainCombustionEngineECT { timestamp value }
      powertrainCombustionEngineDieselExhaustFluidLevel { timestamp value }
      powertrainCombustionEngineTPS { timestamp value }
      powertrainTransmissionTravelledDistance { timestamp value }
      lowVoltageBatteryCurrentVoltage { timestamp value }
      exteriorAirTemperature { timestamp value }
      isIgnitionOn { timestamp value }
      obdStatusDTCCount { timestamp value }
      currentLocationCoordinates { timestamp value { latitude longitude } }
    }
  }
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  try {
    const devJwt     = await getDeveloperJwt();
    const vehicleJwt = await getVehicleJwt(devJwt, parseInt(tokenId));
    const data = await queryTelemetry<{
      signalsLatest: Record<string, { timestamp: string; value: unknown } | null> | null
    }>(vehicleJwt, LATEST_QUERY, { tokenId: parseInt(tokenId) });

    return NextResponse.json(data?.signalsLatest ?? null);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}