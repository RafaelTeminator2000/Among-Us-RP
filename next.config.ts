import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.15.6',
    '192.168.15.2',
    '192.168.1.2',
    '192.168.0.2',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
};

export default nextConfig;
