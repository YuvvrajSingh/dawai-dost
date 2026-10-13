import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep verification builds separate from an active dev server when requested.
  distDir: process.env.DAWAI_NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  // Ship the compiled catalog with the API routes when deploying (e.g. Vercel).
  outputFileTracingIncludes: { "/api/**": ["./data/catalog.json.gz", "./data/kendras.json.gz"] },
  // Camera + microphone are used by the scanner and voice screens.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self)" }],
      },
    ];
  },
};

export default nextConfig;
