import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@noble/curves", "@noble/hashes", "@dimo-network/data-sdk"],
  // Shown next to the release version so a deploy can be recognised from the page.
  env: { NEXT_PUBLIC_BUILD_TIME: new Date().toISOString() },
};

export default nextConfig;
