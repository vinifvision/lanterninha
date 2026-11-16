import type { CapacitorConfig } from '@capacitor/cli';

// Configuração do app de celular (Android).
// O app instalado abre o site publicado (server.url), então cada git push chega a todo mundo
// sem precisar instalar um APK novo. APK novo só quando mudar algo nativo (ícone, nome, plugins).
const config: CapacitorConfig = {
  appId: 'app.lanterninha',
  appName: 'Lanterninha',
  webDir: 'dist',
  backgroundColor: '#0a0a0c',
  server: { url: 'https://lanterninha.vercel.app' },
};

export default config;
