import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second build folder lets the API-mode end-to-end tests (playwright.api.config.ts)
  // build without touching the regular .next output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components are off: on Cloudflare Workers they make requests hang
  // (the adapter does not support them yet). Pages render per request instead.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
