// Boas-vindas: aparece uma vez, para quem abre o app sem conta e sem filmes.
// Ao fundo, uma parede de pôsteres de filmes em alta (TMDB); na frente, criar conta ou entrar.
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Overlay } from '../components/Overlay';
import { Poster } from '../components/Poster';
import { discover } from '../lib/api';
import type { SearchResult } from '../lib/types';
import { nav } from '../nav';

export function Welcome() {
  const [wall, setWall] = useState<SearchResult[]>([]);
  useEffect(() => {
    let alive = true;
    discover('trending')
      .then((l) => { if (alive) setWall(l.filter((f) => f.poster).slice(0, 16)); })
      .catch(() => null);
    return () => { alive = false; };
  }, []);

  const signup = () => { nav.close(); nav.open({ k: 'signup' }); };
  // O formulário de entrar fica na aba Você
  const login = () => { nav.close(); nav.tab('prof'); };

  return (
    <Overlay className="bv">
      <div className="bv-wall" aria-hidden="true">
        {wall.map((f, i) => (
          <span key={f.id} className="bv-p" style={{ animationDelay: `${i * 40}ms` }}>
            <Poster img={f.poster} title={f.title} size="w185" />
          </span>
        ))}
      </div>
      <div className="bv-shade" aria-hidden="true" />
      <div className="bv-beam" aria-hidden="true" />
      <div className="bv-body">
        <img src="/logo.svg" alt="Lanterninha" width={56} height={56} />
        <h1>Seu diário de cinema, com seus amigos.</h1>
        <p>Dê nota sem medo de errar, veja o que os amigos acharam e lembre de tudo que você já viu.</p>
        <Button block id="bvgo" onClick={signup}>Criar minha conta</Button>
        <button type="button" className="bv-in" id="bvin" onClick={login}>
          Já tenho conta: <span>Entrar</span>
        </button>
      </div>
    </Overlay>
  );
}
