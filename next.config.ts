import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@noble/curves", "@noble/hashes", "@dimo-network/data-sdk"],
};

export default nextConfig;
