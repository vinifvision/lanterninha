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
export const StarIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></svg>
);
export const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
);
export const ChestIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9zM4 10V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2M10 10v3h4v-3" /></svg>
);
export const TAB_ICONS = {
  rate: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  home: 'M12 3 2 12h3v8h5v-6h4v6h5v-8h3L12 3z',
  lib: 'M4 3h7v8H4zM13 3h7v8h-7zM4 13h7v8H4zM13 13h7v8h-7z',
  prof: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
} as const;

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
/** Ícones da barra de abas flutuante (traço fino; o do meio é a estrela cheia). */
export function TabIcon({ tab }: { tab: 'home' | 'search' | 'rate' | 'lib' | 'prof' }) {
  switch (tab) {
    case 'home':
      return <svg viewBox="0 0 24 24" {...S}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>;
    case 'search':
      return <svg viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'rate':
      return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z" /></svg>;
    case 'lib':
      return <svg viewBox="0 0 24 24" {...S}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
    case 'prof':
      return <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>;
  }
}
