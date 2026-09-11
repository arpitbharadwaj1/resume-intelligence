import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Resume files are private and served only via signed URLs; no remote image hosts.
  images: { remotePatterns: [] },
};

export default nextConfig;
