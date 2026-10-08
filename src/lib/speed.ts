// Some sources report an unusable speed (the IVECO, fed through the Kaufmann oracle,
// reports ~0 km/h while driving). When the odometer moved, derive the average speed
// from the odometer delta between two readings instead.

type Reading = { odometerKm: number | null | undefined; timestamp: string };

export function deriveSpeedKmh(prev: Reading, cur: Reading, maxGapMs: number): number | null {
  if (prev.odometerKm == null || cur.odometerKm == null) return null;
  const dtMs = new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime();
  const dKm = cur.odometerKm - prev.odometerKm;
  if (!(dtMs > 0) || dtMs > maxGapMs || dKm < 0.5) return null;
  const kmh = dKm / (dtMs / 3_600_000);
  return kmh < 200 ? kmh : null;
}

// Use the derived value only when the reported one is clearly too low.
export function pickSpeed(reported: number | null | undefined, derived: number | null): number | null {
  const r = reported ?? null;
  if (derived != null && derived >= 5 && (r == null || r < derived * 0.5)) return Math.round(derived);
  return r;
}

export function withDerivedSpeeds<T extends { timestamp: string; speed?: number | null; odometer?: number | null }>(
  signals: T[]
): T[] {
  if (signals.length < 2) return signals;

  const gaps = signals
    .slice(1)
    .map((s, i) => new Date(s.timestamp).getTime() - new Date(signals[i].timestamp).getTime())
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  const maxGapMs = Math.max(30 * 60_000, 2.5 * medianGap);

  return signals.map((s, i) => {
    if (i === 0) return s;
    const derived = deriveSpeedKmh(
      { odometerKm: signals[i - 1].odometer, timestamp: signals[i - 1].timestamp },
      { odometerKm: s.odometer, timestamp: s.timestamp },
      maxGapMs
    );
    return { ...s, speed: pickSpeed(s.speed, derived) } as T;
  });
}
