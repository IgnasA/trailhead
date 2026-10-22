import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/http/securityHeaders";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  // Native cross-fade between routes; honours prefers-reduced-motion via CSS.
  experimental: { viewTransition: true },
  transpilePackages: ["@trailhead/domain", "@trailhead/gmail", "@trailhead/history"],
  webpack: (config) => {
    // The shared packages are ESM-correct TypeScript: they import "./x.js"
    // referring to x.ts. Teach the bundler that mapping.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
