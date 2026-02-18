import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/presentation',
  turbopack: {
    resolveAlias: {
      canvas: { browser: "" },
      encoding: { browser: "" },
    },
  },
};

export default nextConfig;
