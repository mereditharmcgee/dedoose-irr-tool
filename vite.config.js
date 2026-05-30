import { defineConfig } from 'vite';

// Base path is './' so the built bundle works whether it is served from the
// root of a project Pages site or a subdirectory of a personal Pages site.
// Override with VITE_BASE at build time if you need an absolute base.
export default defineConfig({
  base: process.env.VITE_BASE || './',
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    setupFiles: ['./test/setup.js'],
  },
});
