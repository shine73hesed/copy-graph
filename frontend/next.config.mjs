/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/test/:path*",
        destination: "http://localhost:8050/test/:path*",
      },
      {
        source: "/auth/:path*",
        destination: "http://localhost:8050/auth/:path*",
      },
      {
        source: "/reading/:path*",
        destination: "http://localhost:8050/reading/:path*",
      },
      { source: "/db/:path*", destination: "http://localhost:8050/db/:path*" },
      {
        source: "/content-images/:path*",
        destination: "http://localhost:8050/content-images/:path*",
      },
      {
        source: "/api/admin/:path*",
        destination: "http://localhost:8050/api/admin/:path*",
      },
      {
        source: "/diagrams/:path*",
        destination: "http://localhost:8050/diagrams/:path*",
      },
    ];
  },
};

export default nextConfig;
