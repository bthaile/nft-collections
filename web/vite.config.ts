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
    alias: [
      {
        find: '@contracts',
        replacement: resolve(__dirname, 'contracts')
      }
    ]
  },
  optimizeDeps: {
    include: ['./contracts/MyNFT.json']
  }
}); 