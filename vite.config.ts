import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O site e o aplicativo saem do mesmo código. As funções em /api continuam rodando na Vercel.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    // Em desenvolvimento, as chamadas a /api vão para o site publicado (lá fica a chave do TMDB).
    proxy: { '/api': { target: 'https://lanterninha.vercel.app', changeOrigin: true } },
  },
});
