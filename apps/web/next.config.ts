import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Читается при сборке: rewrites запекаются в routes-manifest (важно для Docker, этап 8).
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  // Корень монорепо: standalone-сборка должна подтянуть зависимости из корневого node_modules.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // Браузер ходит на /api/*, Next проксирует в Nest (префикс /api срезается).
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
