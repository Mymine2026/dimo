import { NextResponse } from "next/server";
import { matchRoute, type MatchPoint } from "@/lib/osrm";
import { getSessionUser } from "@/lib/access";

const MAX_POINTS = 2000;

export async function POST(req: Request) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { points } = (await req.json()) as { points?: MatchPoint[] };
  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS) {
    return NextResponse.json({ error: `points (2-${MAX_POINTS}) required` }, { status: 400 });
  }

  const matched = await matchRoute(points);
  return NextResponse.json({ matched });
}
