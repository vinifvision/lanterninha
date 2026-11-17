// Um ingresso aberto da gaveta: o ingresso grande, os campos para editar e o atalho para o filme.
import { Overlay, OverlayHeader } from '../components/Overlay';
import { Ticket } from '../components/Ticket';
import { TicketEditor } from '../components/TicketEditor';
import { fkey, useFilms } from '../lib/films';
import { nav } from '../nav';

export function TicketSheet({ filmKey }: { filmKey: string }) {
  const film = useFilms().find((h) => fkey(h) === filmKey);
  if (!film) return null;
  return (
    <Overlay>
      <OverlayHeader left={<button id="tsx" onClick={() => nav.close()}>Fechar</button>} title="Ingresso" />
      <div className="tkwrap"><Ticket film={film} torn /></div>
      <TicketEditor film={film} />
      <button className="cta" id="tsfilm" style={{ marginTop: 22 }} onClick={() => nav.openFilm(film)}>Ver página do filme</button>
    </Overlay>
  );
}
