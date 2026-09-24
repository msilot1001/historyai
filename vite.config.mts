import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel serves `dist` and rewrites /study/*, /coach/*, /review to /.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
