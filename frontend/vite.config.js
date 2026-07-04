import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/recharts')) return 'recharts-vendor';
            if (id.includes('node_modules/framer-motion')) return 'framer-vendor';
            if (id.includes('/src/context/') || id.includes('\\src\\context\\')) {
              return 'app-context';
            }
          },
        },
      },
      chunkSizeWarningLimit: 800
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: 'ws',
        port: 5173,
      },
      proxy: {
        '/api/v1': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/rust/': {
          target: env.VITE_RUST_API_URL || 'http://localhost:8081',
          changeOrigin: true
        },
        '/sitemap.xml': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true
        },
        '/video-sitemap.xml': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  }
})
