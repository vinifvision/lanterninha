// Só vi: os filmes que você marcou como "Já vi" sem dar nota. É o Diário com esse filtro fixo. Abre pelo perfil.
import { isRated } from "../lib/films";
import type { Film } from "../lib/types";
import { Diary } from "./Diary";

/** Filmes vistos que ainda não têm nota (o "Já vi"). */
export const seenOnly = (films: Film[]) => films.filter((h) => h.st !== "want" && !isRated(h));

export function JustSeen() {
  return <Diary seenOnly />;
}
