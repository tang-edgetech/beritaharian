import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cendol/ui", "@cendol/api-client", "@cendol/map"],
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

export default nextConfig;
