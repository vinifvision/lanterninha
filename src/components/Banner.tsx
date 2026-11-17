import { posterUrl } from '../lib/api';

/** Banner do perfil: uma cena de filme no topo, que some suavemente no fundo da tela. */
export function Banner({ path }: { path: string }) {
  if (!path) return null;
  return <div className="pbanner" style={{ backgroundImage: `url(${posterUrl(path, 'w780')})` }} />;
}
