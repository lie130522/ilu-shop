/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Packages ESM-only chargés côté serveur uniquement — ne pas bundler
  experimental: {
    serverComponentsExternalPackages: ['resend'],
  },
  images: {
    remotePatterns: [
      // Unsplash (images produits mockées)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      // Firebase Storage (chat uploads, images admin)
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
};

module.exports = nextConfig;
