import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
  },
  serverExternalPackages: ["mammoth", "pdf-parse"]
};

export default nextConfig;
