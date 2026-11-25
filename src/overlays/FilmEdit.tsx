// Editar um filme avaliado: data, onde viu, ingresso (ou com quem viu), sem refazer a avaliação.
// Também é onde ficam "Mudar nota", "Refazer as perguntas", "Reassisti" e "Apagar".
import { useArmed } from '../components/hooks';
import { Overlay, OverlayHeader } from '../components/Overlay';
import { lastCinema, TicketEditor } from '../components/TicketEditor';
import { WatchedWith } from '../components/WatchedWith';
import { WhenRow } from '../components/WhenRow';
import { films, fkey, isRated, useFilms } from '../lib/films';
import type { Where } from '../lib/types';
import { nav } from '../nav';

const WHERE: [Where | undefined, string][] = [['cine', 'Cinema'], ['casa', 'Em casa'], ['outro', 'Outro'], [undefined, 'Não sei']];

export function FilmEdit({ filmKey }: { filmKey: string }) {
  const found = useFilms().find((h) => fkey(h) === filmKey);
  const film = isRated(found) ? found : null;
  const [armed, press] = useArmed(4000);
  if (!film) return null;

  const setWhere = (w: Where | undefined) => {
    film.w = w;
    if (w === 'cine' && !film.tk) { const c = lastCinema(); if (c) film.tk = { cine: c }; }
    films.save();
  };
  const redo = (rewatch: boolean) => { nav.close(); nav.startQuiz(film, { rewatch: rewatch ? film : null, classic: film.c, help: !rewatch }); };
  const remove = () => { if (!press()) return; films.remove(film); nav.close(); nav.back(); };

  return (
    <Overlay>
      <OverlayHeader left={<button id="fex" onClick={() => nav.close()}>Fechar</button>} title="Editar" right={<button className="ok" id="feok" onClick={() => nav.close()}>Pronto</button>} />
      <h2 className="feh">{film.t}</h2>

      <div className="fesec">
        <WhenRow film={film} />
      </div>

      <div className="fesec">
        <span className="lbl">Onde você viu</span>
        <div className="seg four">
          {WHERE.map(([w, label]) => (
            <button key={label} data-w={w || 'none'} className={film.w === w ? 'on' : ''} onClick={() => setWhere(w)}>{label}</button>
          ))}
        </div>
        {film.w === 'cine' ? <TicketEditor film={film} /> : <WatchedWith film={film} />}
      </div>

      <div className="felist">
        <button id="fest" onClick={() => { nav.close(); nav.startQuiz(film, { classic: film.c, direct: true }); }}><b>Mudar nota</b><small>Escolher a nota direto nas estrelas</small></button>
        <button id="feco" onClick={() => redo(false)}><b>Refazer as perguntas</b><small>Responder o quiz de novo</small></button>
        <button id="fere" onClick={() => redo(true)}><b>Reassisti</b><small>Avaliar de novo e guardar a nota anterior</small></button>
        <button id="fedel" className="del" onClick={remove}><b>{armed ? 'Apagar mesmo?' : 'Apagar dos meus filmes'}</b><small>{armed ? 'Toque de novo para confirmar' : 'Tira a nota, a review e o ingresso'}</small></button>
      </div>
    </Overlay>
  );
}
