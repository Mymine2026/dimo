import { NextResponse } from "next/server";
import { getDeveloperJwt } from "@/lib/dimo";

export async function GET() {
  try {
    const token = await getDeveloperJwt();
    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
