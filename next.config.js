// Next.js configuration file
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['api.majd.chat'],
    formats: ['image/avif', 'image/webp'],
  },
  i18n: {
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    localeDetection: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        "destination": "https://api.majd.chat/api/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};
