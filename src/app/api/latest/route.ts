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
      powertrainFuelSystemAccumulatedConsumption { timestamp value }
      powertrainCombustionEngineTorquePercent { timestamp value }
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

    const raw = data?.signalsLatest;
    if (!raw) return NextResponse.json(null);

    // GraphQL returns each signal as { timestamp, value } — flatten to plain values
    const flattened: Record<string, unknown> = {};
    for (const [key, signal] of Object.entries(raw)) {
      flattened[key] = signal != null && typeof signal === 'object' && 'value' in signal
        ? signal.value
        : signal;
    }
    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}