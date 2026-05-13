import { NextResponse } from "next/server";
import { getDeveloperJwt, getVehicleJwt, queryTelemetry, sanitizeError } from "@/lib/dimo";

const TOKEN_ID = 189019; // Trafic
const FROM     = "2026-05-13T00:00:00Z";
const TO       = "2026-05-13T23:59:59Z";
const INTERVAL = "1h";

const QUERY = `
  query {
    signals(tokenId: ${TOKEN_ID}, interval: "${INTERVAL}", from: "${FROM}", to: "${TO}") {
      timestamp
      odometer: powertrainTransmissionTravelledDistance(agg: LAST)
      speed(agg: AVG)
      speedMax: speed(agg: MAX)
    }
  }
`;

interface RawSignal {
  timestamp: string;
  odometer: number | null;
  speed: number | null;
  speedMax: number | null;
}

export async function GET() {
  try {
    const devJwt     = await getDeveloperJwt();
    const vehicleJwt = await getVehicleJwt(devJwt, TOKEN_ID);
    const data = await queryTelemetry<{ signals: RawSignal[] | null }>(vehicleJwt, QUERY, {});

    const signals = data?.signals ?? [];

    // Simulate the analytics km calculation on this data
    const withOdo = signals.filter(s => s.odometer != null);
    const firstOdo = withOdo[0]?.odometer ?? null;
    const lastOdo  = withOdo[withOdo.length - 1]?.odometer ?? null;
    const odoDelta = firstOdo != null && lastOdo != null ? lastOdo - firstOdo : null;

    let kmTrapezoidal = 0;
    for (let i = 1; i < signals.length; i++) {
      const v0 = signals[i - 1].speed ?? 0;
      const v1 = signals[i].speed ?? 0;
      const dtH = (new Date(signals[i].timestamp).getTime() - new Date(signals[i - 1].timestamp).getTime()) / 3_600_000;
      kmTrapezoidal += ((v0 + v1) / 2) * dtH;
    }

    return NextResponse.json({
      tokenId: TOKEN_ID,
      period: { from: FROM, to: TO, interval: INTERVAL },
      totalSignals: signals.length,
      odometer: {
        first: firstOdo,
        last: lastOdo,
        delta: odoDelta,
        anomalous: odoDelta != null && odoDelta > 500,
      },
      kmTrapezoidal: Math.round(kmTrapezoidal),
      signals: signals.map(s => ({
        t: s.timestamp.slice(0, 16),
        odo: s.odometer,
        speed_avg: s.speed != null ? Math.round(s.speed) : null,
        speed_max: s.speedMax != null ? Math.round(s.speedMax) : null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
