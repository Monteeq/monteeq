import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['react-paystack']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'recharts-vendor': ['recharts'],
            'framer-vendor': ['framer-motion'],
            'ui-vendor': ['lucide-react', 'react-paystack']
          }
        }
      },
      chunkSizeWarningLimit: 800
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
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
