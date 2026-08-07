import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/piazinho",
  trailingSlash: true,
  devIndicators: false,
};

export default nextConfig;
