import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cendol/ui", "@cendol/api-client"],
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
