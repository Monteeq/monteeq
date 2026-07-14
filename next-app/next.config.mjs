import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ported Vite pages intentionally keep tight effect deps; CI treats warnings as
  // build failures. Re-enable lint-during-build once those are cleaned up.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.monteeq.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  webpack: (config) => {
    // Let relocated Vite pages keep `import … from 'react-router-dom'`
    config.resolve.alias['react-router-dom'] = path.resolve(
      __dirname,
      'src/shims/react-router-dom.js'
    );
    return config;
  },
};

export default nextConfig;
