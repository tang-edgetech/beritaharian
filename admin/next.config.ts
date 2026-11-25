import type { NextConfig } from "next";

/*
  The admin panel is a signed-in tool: every page depends on the person's token, so it
  renders in the browser and does not use Cache Components / prerendered shells.
*/
const nextConfig: NextConfig = {
  transpilePackages: ["@cendol/ui", "@cendol/api-client"],
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
