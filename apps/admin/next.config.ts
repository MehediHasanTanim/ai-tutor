import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Types come from a workspace package that ships TypeScript source.
  transpilePackages: ['@ai-tutor/shared-types'],
  // This panel is internal and handles admin credentials; nothing here should
  // be framed or sniffed.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default config;
