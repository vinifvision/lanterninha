// Ícones em SVG usados nos botões e nas abas.
export const ShareIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
);
export const SendIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
);
export const PlayIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" /></svg>
);
export const GearIcon = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5z" /></svg>
);
export const TAB_ICONS = {
  rate: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  home: 'M12 3 2 12h3v8h5v-6h4v6h5v-8h3L12 3z',
  lib: 'M4 3h7v8H4zM13 3h7v8h-7zM4 13h7v8H4zM13 13h7v8h-7z',
  prof: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
} as const;
