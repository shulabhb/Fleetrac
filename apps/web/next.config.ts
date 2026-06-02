import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/bob", destination: "/", permanent: false },
      { source: "/bob/:path*", destination: "/", permanent: false },
      { source: "/activity", destination: "/", permanent: false },
      { source: "/controls", destination: "/systems", permanent: false },
      { source: "/controls/:path*", destination: "/systems", permanent: false },
      { source: "/usage", destination: "/", permanent: false },
      { source: "/rules", destination: "/settings", permanent: false }
    ];
  }
};

export default nextConfig;
