import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@delegate/domain", "@delegate/runtime"],
};

export default nextConfig;
