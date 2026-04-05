import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@delegate/domain",
    "@delegate/web-data",
    "@delegate/web-ui",
    "@delegate/model-runtime",
    "@delegate/runtime",
    "@delegate/lifecycle-hooks",
  ],
};

export default nextConfig;
