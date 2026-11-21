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
  /** Onde viu: cinema, em casa ou outro lugar */
  w?: Where;
  /** Ingresso (só quando viu no cinema) */
  tk?: Ticket;
  /** Lembrado pelo Baú da infância */
  b?: 1;
}

export type Where = 'cine' | 'casa' | 'outro';

export interface Ticket {
  /** Nome do cinema */
  cine?: string;
  /** Amigos que foram junto (ids) */
  with?: string[];
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

/** Aviso de ingresso: um amigo disse que vocês viram um filme juntos no cinema. */
export interface CineTag { id: number; p: Profile; film: FilmInfo; cine: string; seen: string }
export type TagStatus = 'pending' | 'accepted' | 'declined';

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
  /** Data de lançamento (AAAA-MM-DD), vazia se o TMDB não souber */
  release: string;
  genres: string[];
  director: string;
  backdrop: string;
  cast: string[];
  trailer: string;
  providers: Record<'stream' | 'rent' | 'buy', { name: string; logo: string }[]>;
  /** Série de filmes a que ele pertence, em ordem de lançamento (null se for avulso) */
  collection: { name: string; parts: FilmInfo[] } | null;
}

export interface SearchResult {
  id: number;
  title: string;
  original: string;
  year: string;
  poster: string;
}
