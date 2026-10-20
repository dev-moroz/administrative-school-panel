import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Read at build time: rewrites are baked into routes-manifest (matters for Docker).
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo root, so the standalone build can trace dependencies from the root node_modules.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // The browser calls /api/*; Next proxies it to Nest with the /api prefix stripped.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
