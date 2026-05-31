import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev server resources (HMR) to be loaded when visiting via LAN IP (mobile testing).
  allowedDevOrigins: [
    "http://192.168.1.156:3000",
    "http://192.168.1.156:3001",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
};

export default nextConfig;
