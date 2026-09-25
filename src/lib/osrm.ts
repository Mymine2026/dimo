const OSRM_URL = process.env.OSRM_URL ?? "http://osrm:5000";
const CHUNK_SIZE = 100; // OSRM's default --max-matching-size-safe chunk

export interface MatchPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface OsrmMatchResponse {
  code: string;
  matchings?: { geometry: { coordinates: [number, number][] } }[];
}

// Snap a sequence of GPS points to the road network via a self-hosted OSRM
// Match service. Returns [lat, lng] pairs for the matched route, or null if
// OSRM can't match the trace (too sparse, off-road, etc.) — callers should
// fall back to drawing a straight polyline between the raw points.
export async function matchRoute(points: MatchPoint[]): Promise<[number, number][] | null> {
  if (points.length < 2) return null;

  const chunks: MatchPoint[][] = [];
  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    chunks.push(points.slice(i, i + CHUNK_SIZE));
  }

  const results: [number, number][] = [];
  for (const chunk of chunks) {
    const coords = chunk.map(p => `${p.longitude},${p.latitude}`).join(";");
    const timestamps = chunk.map(p => Math.floor(new Date(p.timestamp).getTime() / 1000)).join(";");
    const url = `${OSRM_URL}/match/v1/driving/${coords}?geometries=geojson&overview=full&timestamps=${timestamps}`;

    try {
      const res = await fetch(url);
      const data = (await res.json()) as OsrmMatchResponse;
      if (data.code !== "Ok" || !data.matchings?.length) continue;
      for (const matching of data.matchings) {
        for (const [lng, lat] of matching.geometry.coordinates) {
          results.push([lat, lng]);
        }
      }
    } catch {
      // OSRM unreachable/timed out for this chunk — skip it, caller falls back per-trip
    }
  }

  return results.length > 0 ? results : null;
}
