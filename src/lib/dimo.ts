const CLIENT_ID    = process.env.DIMO_CLIENT_ID!;
const API_KEY      = process.env.DIMO_API_KEY!;
const REDIRECT_URI = process.env.DIMO_REDIRECT_URI!;
const DIMO_DOMAIN  = process.env.DIMO_DOMAIN ?? REDIRECT_URI;

const AUTH_BASE    = "https://auth.dimo.zone";
export const IDENTITY_API  = "https://identity-api.dimo.zone";
export const TELEMETRY_API = "https://telemetry-api.dimo.zone";

async function ethSign(message: string, privateKeyHex: string): Promise<string> {
  const { secp256k1 } = await import("@noble/curves/secp256k1");
  const { keccak_256 } = await import("@noble/hashes/sha3");
  const msgBytes = new TextEncoder().encode(message);
  const prefix   = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const combined = new Uint8Array(prefix.length + msgBytes.length);
  combined.set(prefix);
  combined.set(msgBytes, prefix.length);
  const hash    = keccak_256(combined);
  const privKey = Uint8Array.from(Buffer.from(privateKeyHex.replace(/^0x/, ""), "hex"));
  const sig     = secp256k1.sign(hash, privKey, { lowS: true });
  const r = sig.r.toString(16).padStart(64, "0");
  const s = sig.s.toString(16).padStart(64, "0");
  const v = (sig.recovery + 27).toString(16).padStart(2, "0");
  return "0x" + r + s + v;
}

// Obtain a Developer JWT using Client ID + API Key directly (no SDK, bypasses axios quirks).
export async function getDeveloperJwt(): Promise<string> {
  // Step 1: generate challenge
  const challengeUrl = new URL(`${AUTH_BASE}/auth/web3/generate_challenge`);
  challengeUrl.searchParams.set("client_id", CLIENT_ID);
  challengeUrl.searchParams.set("domain", DIMO_DOMAIN);
  challengeUrl.searchParams.set("scope", "openid email");
  challengeUrl.searchParams.set("response_type", "code");
  challengeUrl.searchParams.set("address", CLIENT_ID);

  const cRes  = await fetch(challengeUrl.toString(), { method: "POST" });
  const cText = await cRes.text();
  let cData: { challenge: string; state: string };
  try { cData = JSON.parse(cText); } catch {
    throw new Error(`Auth challenge: invalid response (${cRes.status}): ${cText.slice(0, 200)}`);
  }
  if (!cRes.ok || !cData.challenge) {
    throw new Error(`Auth challenge failed (${cRes.status}): ${cText.slice(0, 200)}`);
  }

  // Step 2: sign the challenge
  const signature = await ethSign(cData.challenge, API_KEY);

  // Step 3: submit the signed challenge
  const body = new URLSearchParams({
    client_id:  CLIENT_ID,
    domain:     DIMO_DOMAIN,
    grant_type: "authorization_code",
    state:      cData.state,
    signature,
  });
  const sRes  = await fetch(`${AUTH_BASE}/auth/web3/submit_challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const sText = await sRes.text();
  let sData: { access_token?: string; token?: string } = {};
  // DIMO API sometimes returns two concatenated JSON objects
  // Try full parse first, then extract token with regex
  try {
    sData = JSON.parse(sText);
  } catch {
    // Try to extract access_token from concatenated JSON response
    const tokenMatch = sText.match(/"access_token"\s*:\s*"([^"]+)"/);
    if (tokenMatch) {
      sData = { access_token: tokenMatch[1] };
    } else {
      throw new Error(`Auth submit: invalid response (${sRes.status}): ${sText.slice(0, 200)}`);
    }
  }
  const token = sData?.access_token ?? sData?.token ?? "";
  if (!token) throw new Error(`Auth submit: no token in response (${sRes.status}): ${sText.slice(0, 200)}`);
  return token.replace(/^"|"$/g, "");
}

const TOKEN_EXCHANGE_URL = "https://token-exchange-api.dimo.zone/v1/tokens/exchange";
const VEHICLE_NFT_ADDRESS = "0xbA5738a18d83D41847dfFbDC6101d37C69c9B0cF";

// Exchange Developer JWT for a Vehicle JWT (direct fetch, bypasses SDK axios quirks)
export async function getVehicleJwt(developerJwt: string, tokenId: number): Promise<string> {
  const res = await fetch(TOKEN_EXCHANGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${developerJwt}`,
    },
    body: JSON.stringify({
      nftContractAddress: VEHICLE_NFT_ADDRESS,
      privileges: [1, 3, 4],
      tokenId,
    }),
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Token exchange: bad response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${data?.message ?? text.slice(0, 200)}`);
  }
  const raw: string = data?.token ?? data?.access_token ?? "";
  // Strip surrounding double-quotes if the API double-serialized the value
  return raw.replace(/^"|"$/g, "");
}

// Query Identity API (public, no auth required)
export async function queryIdentity<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${IDENTITY_API}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next: { revalidate: 60 } as any,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

// Query Telemetry API (requires Vehicle JWT)
export async function queryTelemetry<T>(vehicleJwt: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TELEMETRY_API}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${vehicleJwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? json.error ?? `Telemetry API error ${res.status}`);
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

// Strip JWT tokens and long base64 blobs from error messages before sending to client
export function sanitizeError(err: unknown): string {
  return String(err)
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]*/g, "<token>")
    .slice(0, 300);
}

export { CLIENT_ID as DIMO_CLIENT_ID, REDIRECT_URI as DIMO_REDIRECT_URI };
