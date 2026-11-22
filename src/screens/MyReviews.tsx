// Reviews: só os filmes em que você escreveu alguma coisa, do mais recente para o mais antigo. Abre pelo perfil.
import { Poster } from "../components/Poster";
import { fkey, isRated, useFilms } from "../lib/films";
import { fmt, MONTHS } from "../lib/format";
import type { Film } from "../lib/types";
import { nav } from "../nav";
import { byDiary } from "./Diary";

/** Filmes vistos que têm review escrita. */
export const withReview = (films: Film[]) => films.filter((h) => h.st !== "want" && (h.note || "").trim());

export function MyReviews() {
  const list = withReview(useFilms()).sort(byDiary);
  const when = (d?: string) => (d ? `${+d.slice(8, 10)} de ${MONTHS[+d.slice(5, 7) - 1].toLowerCase()} de ${d.slice(0, 4)}` : "");
  return (
    <div className="screen v2diary">
      <h1 className="v2dh">Reviews</h1>
      {list.length === 0 && (
        <p className="empty">Quando você escrever algo sobre um filme na hora de avaliar, a review aparece aqui.</p>
      )}
      <div className="v2revs">
        {list.map((h) => (
          <button key={fkey(h)} className="v2rev" onClick={() => nav.openFilm(h)}>
            <span className="v2dpos"><Poster img={h.img} title={h.t} size="w92" /></span>
            <span className="v2revt">
              <b>{h.t}</b>
              <span>
                <em>{isRated(h) ? "★ " + fmt(h.s) : "Já vi"}</em>
                {h.d && <small>{when(h.d)}</small>}
              </span>
              <q>{h.note!.trim()}</q>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
