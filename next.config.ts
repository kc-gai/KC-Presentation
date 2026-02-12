import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: { browser: "" },
      encoding: { browser: "" },
    },
  },
};

export default nextConfig;
