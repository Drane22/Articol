/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is2-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is3-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is4-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is5-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'coverartarchive.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.discogs.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lastfm.freetls.fastly.net',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['@xenova/transformers', 'sharp', 'pg'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

module.exports = nextConfig;
