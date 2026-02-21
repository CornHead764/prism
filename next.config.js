const { buildSecurityHeaders } = require('./src/lib/utils/securityHeaders');

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5,
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['react-grid-layout'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.icloud.com' },
      { protocol: 'https', hostname: '*.sharepoint.com' },
      { protocol: 'https', hostname: '*.live.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'openweathermap.org' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders(),
      },
    ];
  },

  async redirects() {
    return [];
  },

  webpack: (config, { isServer }) => {
    return config;
  },

  env: {
    NEXT_PUBLIC_APP_NAME: 'Prism',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

module.exports = withPWA(nextConfig);
