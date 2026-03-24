import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@delegate/domain", "@delegate/web-data", "@delegate/web-ui"],
};

export default nextConfig;
