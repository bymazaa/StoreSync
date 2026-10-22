import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;