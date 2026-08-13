import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `import.meta.dirname` rather than `__dirname` — the latter is
    // unavailable under Vite's native config loader.
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5173, host: true },
});
