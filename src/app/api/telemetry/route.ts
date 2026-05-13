import { NextResponse } from "next/server";
import { getDeveloperJwt, getVehicleJwt, queryTelemetry, sanitizeError } from "@/lib/dimo";

export const maxDuration = 45;

function intervalForHours(hours: number): string {
  if (hours <= 24)  return "10m";
  if (hours <= 168) return "1h";
  if (hours <= 720) return "6h";
  return "12h";
}

// Full query — used by the vehicle detail page (needs all sensor fields)
const TELEMETRY_QUERY = `
  query GetVehicleSignals($tokenId: Int!, $interval: String!, $from: Time!, $to: Time!) {
    signals(tokenId: $tokenId, interval: $interval, from: $from, to: $to) {
      timestamp
      speed(agg: AVG)
      speedMax: speed(agg: MAX)
      fuelLevel: powertrainFuelSystemRelativeLevel(agg: AVG)
      fuelAbsolute: powertrainFuelSystemAbsoluteLevel(agg: LAST)
      range: powertrainRange(agg: LAST)
      location: currentLocationCoordinates(agg: LAST) {
        latitude
        longitude
      }
      engineRpm: powertrainCombustionEngineSpeed(agg: AVG)
      engineCoolantTemp: powertrainCombustionEngineECT(agg: AVG)
      throttle: powertrainCombustionEngineTPS(agg: AVG)
      adBlue: powertrainCombustionEngineDieselExhaustFluidLevel(agg: LAST)
      batteryVoltage: lowVoltageBatteryCurrentVoltage(agg: AVG)
      odometer: powertrainTransmissionTravelledDistance(agg: LAST)
      exteriorTemp: exteriorAirTemperature(agg: AVG)
      isIgnitionOn(agg: LAST)
      torquePercent: powertrainCombustionEngineTorquePercent(agg: AVG)
      accumulatedConsumption: powertrainFuelSystemAccumulatedConsumption(agg: LAST)
    }
  }
`;

// Slim query — used by analytics page; only trip-detection fields, avoids DIMO timeout on 30d ranges
const TELEMETRY_SLIM_QUERY = `
  query GetVehicleSignalsSlim($tokenId: Int!, $interval: String!, $from: Time!, $to: Time!) {
    signals(tokenId: $tokenId, interval: $interval, from: $from, to: $to) {
      timestamp
      speed(agg: AVG)
      speedMax: speed(agg: MAX)
      location: currentLocationCoordinates(agg: LAST) {
        latitude
        longitude
      }
      odometer: powertrainTransmissionTravelledDistance(agg: LAST)
    }
  }
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("tokenId");
  const slim    = searchParams.get("slim") === "1";
  const hoursParam = parseInt(searchParams.get("hours") ?? "720");
  const from = searchParams.get("from") ?? new Date(Date.now() - hoursParam * 60 * 60 * 1000).toISOString();
  const to   = searchParams.get("to")   ?? new Date().toISOString();

  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const diffHours = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60);
  const interval = searchParams.get("interval") ?? intervalForHours(diffHours);

  const query = slim ? TELEMETRY_SLIM_QUERY : TELEMETRY_QUERY;

  try {
    const devJwt     = await getDeveloperJwt();
    const vehicleJwt = await getVehicleJwt(devJwt, parseInt(tokenId));
    const data = await queryTelemetry<{ signals: unknown[] | null }>(vehicleJwt, query, {
      tokenId: parseInt(tokenId),
      interval,
      from,
      to,
    });
    return NextResponse.json(data?.signals ?? []);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
