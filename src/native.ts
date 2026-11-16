// Coisas que só existem no app de celular (Android): por enquanto, o botão físico de voltar.
import { App as NativeApp } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativeApp } from './lib/config';
import { nav } from './nav';

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
