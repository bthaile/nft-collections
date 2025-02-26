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
      '@': resolve(__dirname, 'src')
    }
  }
}); 