/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // afterFiles: Next.js matches /pages/api/* (e.g. NextAuth) first; only then proxy to Flask.
      // beforeFiles can run before filesystem routing in some setups and is risky for /api/auth/*.
      afterFiles: [
        {
          source: '/api/backend/:path*',
          destination: 'http://127.0.0.1:5000/:path*',
        },
      ],
    };
  },
  compress: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
