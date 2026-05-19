import { defineConfig } from 'vite';

export default defineConfig({
  base: '/2/',
  server: {
    port: 5173,
  },
  preview: {
    port: 8096,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
