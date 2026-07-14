/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Production CDN + S3
      { protocol: 'https', hostname: 'cdn.monteeq.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      // UI fallbacks used in production components (avatars, placeholders)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
};

export default nextConfig;
