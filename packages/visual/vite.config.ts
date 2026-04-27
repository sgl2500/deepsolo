import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Phaser 本身较大，当前单页游戏不拆运行时；提高阈值避免构建误报大 chunk。
    chunkSizeWarningLimit: 1800,
  },
  server: {
    port: 3456,
    open: true,
  },
});
