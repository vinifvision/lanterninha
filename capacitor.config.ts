import type { CapacitorConfig } from '@capacitor/cli';

// Configuração do app de celular (Android). O Capacitor empacota a pasta dist dentro de um app nativo.
const config: CapacitorConfig = {
  appId: 'app.lanterninha',
  appName: 'Lanterninha',
  webDir: 'dist',
  backgroundColor: '#0a0a0c',
};

export default config;
