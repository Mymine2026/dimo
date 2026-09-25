import { NextResponse } from "next/server";
import { matchRoute, type MatchPoint } from "@/lib/osrm";

export async function POST(req: Request) {
  const { points } = (await req.json()) as { points?: MatchPoint[] };
  if (!Array.isArray(points) || points.length < 2) {
    return NextResponse.json({ error: "points (>=2) required" }, { status: 400 });
  }

  const matched = await matchRoute(points);
  return NextResponse.json({ matched });
}
