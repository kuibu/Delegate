import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@delegate/domain", "@delegate/runtime", "@delegate/registry"],
};

export default nextConfig;
