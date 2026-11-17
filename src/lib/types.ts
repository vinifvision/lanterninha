// Tipos centrais do Lanterninha.

/** Estados de um filme sem nota: na fila ou já visto. Filme avaliado não tem `st`. */
export type FilmState = 'want' | 'seen';

/** Um filme na lista de alguém. Os nomes curtos são os mesmos gravados no aparelho e na nuvem. */
export interface Film {
  /** Título */
  t: string;
  /** Nota, de 0.5 a 5 (só em filmes avaliados) */
  s?: number;
  /** Estado quando não há nota */
  st?: FilmState;
  /** Avaliado no modo clássico */
  c: boolean;
  /** Id do filme no TMDB */
  id?: number;
  /** Ano */
  y?: string;
  /** Título original */
  o?: string;
  /** Caminho do pôster no TMDB */
  img?: string;
  /** Nota anterior (quando reassistido) */
  p?: number;
  /** Quantas vezes foi visto */
  n?: number;
  /** Data em que foi visto (AAAA-MM-DD) */
  d?: string;
  /** Cor viva tirada do pôster */
  col?: string;
  /** Momento do registro, para ordenar */
  ts?: number;
  /** Review */
  note?: string;
  /** Quem indicou (só na fila) */
  by?: string;
}

export type RatedFilm = Film & { s: number };

/** O mínimo para identificar e mostrar um filme, esteja ou não na lista. */
export interface FilmInfo {
  id?: number | null;
  t: string;
  y?: string;
  o?: string;
  img?: string;
}

export interface TopItem {
  id: number | null;
  t: string;
  img: string;
  y: string;
}

export interface Profile {
  id?: string;
  username: string;
  display_name: string;
  bio: string;
  avatar: string;
  /** Imagem de fundo do perfil: caminho de uma cena de filme no TMDB */
  banner: string;
  top4: (TopItem | null)[];
}

export interface Friends {
  list: Profile[];
  incoming: Profile[];
  outgoing: Profile[];
}

export interface Rec {
  id: number;
  p: Profile;
  film: Film;
  note: string;
}

/** A nota (e a review) de um amigo para um filme. */
export interface FriendRating {
  p: Profile;
  f: RatedFilm;
}

export interface MovieDetails {
  overview: string;
  runtime: number;
  genres: string[];
  director: string;
  backdrop: string;
  cast: string[];
  trailer: string;
  providers: Record<'stream' | 'rent' | 'buy', { name: string; logo: string }[]>;
}

export interface SearchResult {
  id: number;
  title: string;
  original: string;
  year: string;
  poster: string;
}
