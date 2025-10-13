import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/tristar-fitness-clean/' : '/',
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'utils-vendor': ['date-fns', 'zustand', 'lucide-react'],
          'charts-vendor': ['recharts'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: mode === 'development',
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3000, // Frontend port
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:6868',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:6868',
        changeOrigin: true,
        secure: false,
      }
    }
  },
}));