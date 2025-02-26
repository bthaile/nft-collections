import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3000
  },
  base: '/',
  resolve: {
    alias: {
      '@contracts': resolve(__dirname, 'contracts')
    }
  },
  optimizeDeps: {
    include: ['./contracts/MyNFT.json']
  },
  assetsInclude: ['**/*.json']
}); 