import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  server: {
    port: 5199,
    fs: { allow: [path.resolve(__dirname, '..')] },
    // git checkout/stash swaps inodes and loses the default watcher.
    watch: { usePolling: true, interval: 300 },
  },
});
