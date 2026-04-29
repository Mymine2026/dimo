import { NextResponse } from "next/server";

// DIMO Connect redirects here after vehicle authorization:
// GET /api/auth/callback?code=<auth_code>&token_id=<vehicle_token_id>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const tokenId = searchParams.get("token_id") ?? searchParams.get("tokenId");

  // If DIMO passes a vehicle tokenId directly, redirect to that vehicle's page
  if (tokenId) {
    return NextResponse.redirect(new URL(`/vehicles/${tokenId}?connected=1`, req.url));
  }

  // Otherwise redirect to vehicles list so user can see the newly connected vehicle
  const redirectUrl = new URL("/vehicles", req.url);
  if (code) redirectUrl.searchParams.set("code", code);
  return NextResponse.redirect(redirectUrl);
}
