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

const DISCOVERY_QUERY = `
  query DiscoverSignals($tokenId: Int!) {
    signalsLatest(tokenId: $tokenId) {
      speed { timestamp value }
      powertrainFuelSystemRelativeLevel { timestamp value }
      powertrainFuelSystemAbsoluteLevel { timestamp value }
      powertrainFuelSystemAccumulatedConsumption { timestamp value }
      powertrainFuelSystemSupportedFuelTypes { timestamp value }
      powertrainRange { timestamp value }
      powertrainCombustionEngineSpeed { timestamp value }
      powertrainCombustionEngineECT { timestamp value }
      powertrainCombustionEngineTPS { timestamp value }
      powertrainCombustionEngineEOP { timestamp value }
      powertrainCombustionEngineEOT { timestamp value }
      powertrainCombustionEngineTorque { timestamp value }
      powertrainCombustionEngineTorquePercent { timestamp value }
      powertrainCombustionEngineEngineOilLevel { timestamp value }
      powertrainCombustionEngineDieselExhaustFluidLevel { timestamp value }
      powertrainCombustionEngineDieselExhaustFluidCapacity { timestamp value }
      powertrainTransmissionTravelledDistance { timestamp value }
      powertrainTransmissionCurrentGear { timestamp value }
      lowVoltageBatteryCurrentVoltage { timestamp value }
      exteriorAirTemperature { timestamp value }
      isIgnitionOn { timestamp value }
      obdStatusDTCCount { timestamp value }
      obdBarometricPressure { timestamp value }
      obdIntakeTemp { timestamp value }
      currentLocationCoordinates { timestamp value { latitude longitude } }
      chassisAxleRow1WheelLeftTirePressure { timestamp value }
      chassisAxleRow1WheelRightTirePressure { timestamp value }
    }
  }
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = parseInt(searchParams.get("tokenId") ?? "189019");

  try {
    const devJwt = await getDeveloperJwt();
    const vehicleJwt = await getVehicleJwt(devJwt, tokenId);

    const res = await fetch(`${TELEMETRY_API}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${vehicleJwt}`,
      },
      body: JSON.stringify({ query: DISCOVERY_QUERY, variables: { tokenId } }),
    });
    const raw = await res.json();

    if (!res.ok || raw.errors) {
      return NextResponse.json({ error: raw.errors ?? raw }, { status: 500 });
    }

    const signals = raw.data?.signalsLatest ?? {};
    const available: Record<string, { timestamp: string; value: unknown }> = {};
    const unavailable: string[] = [];

    for (const [key, val] of Object.entries(signals)) {
      if (val !== null && val !== undefined) {
        available[key] = val as { timestamp: string; value: unknown };
      } else {
        unavailable.push(key);
      }
    }

    return NextResponse.json({ tokenId, available, unavailable });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
