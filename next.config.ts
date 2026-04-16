import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Silence the workspace-root warning when a parent folder has its own lockfile.
  turbopack: {
    root: __dirname,
  },
  // Output standalone for smaller Railway image (optional).
  // output: 'standalone',
  async headers() {
    return [
      {
        source: '/api/data/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=30, stale-while-revalidate=300' },
        ],
      },
    ];
  },
};

export default nextConfig;
