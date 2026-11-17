// Coisas que só existem no app de celular (Android): por enquanto, o botão físico de voltar.
import { App as NativeApp } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativeApp } from './lib/config';
import { nav } from './nav';

/** Número da versão do APK instalado (o versionCode). No site, devolve null. */
export async function appBuild(): Promise<number | null> {
  // Nos testes automáticos, a versão pode ser simulada aqui
  const fake = (window as unknown as { __LANTERNINHA_TEST_BUILD__?: number }).__LANTERNINHA_TEST_BUILD__;
  if (typeof fake === 'number') return fake;
  if (!isNativeApp) return null;
  try {
    const n = Number((await NativeApp.getInfo()).build);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

export function setupNative() {
  if (!isNativeApp) return;
  document.documentElement.classList.add('native');
  // Fundo escuro: ícones claros na barra de status
  void SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => { /* versão antiga do app */ });
  void NativeApp.addListener('backButton', () => {
    const { stack, overlays, tab } = nav.state;
    if (overlays.length || stack.length) nav.back();
    else if (tab !== 'rate') nav.tab('rate');
    else void NativeApp.exitApp();
  });
}
