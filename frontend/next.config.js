/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the frontend to call the FastAPI backend (Railway URL in prod)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
