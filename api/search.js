// Função do servidor (Vercel). Recebe ?q=nome&page=N, consulta o TMDB e devolve uma página de filmes.
// A chave vem da variável de ambiente TMDB_KEY, configurada no painel da Vercel.
//
// Busca tolerante a erro de digitação: o TMDB só acha palavras certas (ou o começo delas),
// então "agente secreta" não acha "O Agente Secreto". Na página 1 fazemos também buscas
// pelo radical das palavras ("agen secre", "secre"), juntamos tudo e ordenamos pelo nome
// mais parecido com o que a pessoa digitou. As páginas seguintes continuam a busca principal.
// O TMDB já procura pelo título em português e pelo título original.
//
// Com ?type=person (atores, diretores...) ou ?type=company (produtoras) a busca é a mesma,
// só que pelo nome da pessoa ou da produtora. Esses vêm com "sim" (0 a 1: quanto o nome
// se parece com o digitado), para o app mostrar só os que batem bem na aba "Tudo".
const MAX_PAGE = 500;

/** Minúsculas, sem acento e sem pontuação. */
const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const words = (s) => norm(s).split(' ').filter(Boolean);

/** Radical: corta o fim das palavras longas, onde costuma estar o erro (secreta → secre). */
const stem = (w) => (w.length >= 5 ? w.slice(0, Math.max(4, w.length - 2)) : w);

function lev(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** De 0 a 1: quanto o nome do filme se parece com o que foi digitado. */
function similarity(qw, title) {
  const tw = words(title);
  if (!qw.length || !tw.length) return 0;
  let sum = 0;
  let weight = 0;
  for (const q of qw) {
    let best = 0;
    for (const t of tw) {
      const s = t.startsWith(q) ? 1 : 1 - lev(q, t) / Math.max(q.length, t.length);
      if (s > best) best = s;
    }
    sum += best * q.length;
    weight += q.length;
  }
  return sum / weight;
}

async function tmdb(key, kind, q, page) {
  const url =
    'https://api.themoviedb.org/3/search/' + kind + '?language=pt-BR&include_adult=false' +
    '&page=' + page + '&api_key=' + encodeURIComponent(key) + '&query=' + encodeURIComponent(q);
  const r = await fetch(url);
  if (!r.ok) throw new Error('tmdb');
  const d = await r.json();
  return {
    results: Array.isArray(d.results) ? d.results : [],
    totalPages: Number.isInteger(d.total_pages) ? d.total_pages : 0,
    totalResults: Number.isInteger(d.total_results) ? d.total_results : 0,
  };
}

const toOut = (m) => ({
  id: m.id,
  title: m.title,
  original: m.original_title,
  year: (m.release_date || '').slice(0, 4),
  poster: m.poster_path || '',
});

// Pelo que a pessoa é conhecida, em português
const KNOWN = {
  Acting: 'Atuação', Directing: 'Direção', Writing: 'Roteiro', Production: 'Produção', Camera: 'Fotografia',
  Editing: 'Montagem', Sound: 'Trilha sonora', Art: 'Design de produção', 'Costume & Make-Up': 'Figurino',
};
const round2 = (n) => Math.round(n * 100) / 100;

/** O que muda entre buscar filme, pessoa ou produtora. */
const KINDS = {
  movie: {
    ok: (m) => typeof m.title === 'string',
    names: (m) => [m.title, m.original_title],
    out: (m) => toOut(m),
  },
  person: {
    // Sem foto e sem nenhum filme conhecido costuma ser cadastro vazio
    ok: (m) => typeof m.name === 'string' && (m.profile_path || (Array.isArray(m.known_for) && m.known_for.length)),
    names: (m) => [m.name, m.original_name],
    out: (m, sim) => ({
      id: m.id,
      name: m.name,
      photo: m.profile_path || '',
      known: KNOWN[m.known_for_department] || '',
      knownFor: (Array.isArray(m.known_for) ? m.known_for : [])
        .filter((x) => x && x.media_type !== 'tv')
        .map((x) => x.title || x.name)
        .filter((t) => typeof t === 'string')
        .slice(0, 2),
      pop: Math.round((m.popularity || 0) * 10) / 10,
      sim: round2(sim),
    }),
  },
  company: {
    ok: (m) => typeof m.name === 'string',
    names: (m) => [m.name],
    out: (m, sim) => ({ id: m.id, name: m.name, photo: m.logo_path || '', country: m.origin_country || '', sim: round2(sim) }),
  },
};

export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const q = (params.get('q') || '').trim().slice(0, 80);
    const type = params.get('type') || 'movie';
    const kind = Object.hasOwn(KINDS, type) ? KINDS[type] : null;
    if (!kind) return Response.json({ error: 'tipo inválido' }, { status: 400 });
    const simOf = (m) => Math.max(...kind.names(m).map((n) => similarity(qw, n)));
    const pageRaw = params.get('page') || '1';
    const page = /^\d{1,3}$/.test(pageRaw) ? Number(pageRaw) : 0;
    if (page < 1 || page > MAX_PAGE) return Response.json({ error: 'página inválida' }, { status: 400 });
    if (q.length < 2) return Response.json({ results: [], page, totalPages: 0 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const qw = words(q);
    // Busca pelos radicais (sem palavras de uma letra, como "o" e "a")
    const stemQ = qw.filter((w) => w.length > 1).map(stem).join(' ');
    // E só pela palavra mais longa, para quando a busca acima ainda não acha nada
    const longest = [...qw].sort((a, b) => b.length - a.length)[0] || '';
    const longQ = longest.length >= 4 ? stem(longest) : '';

    const headers = { 'Cache-Control': 'public, s-maxage=86400' };
    const hasStem = stemQ.length >= 2 && stemQ !== norm(q);
    try {
      if (page > 1) {
        // Continua a busca principal; se ela não achou nada, continua a dos radicais
        let base = await tmdb(key, type, q, page);
        if (!base.totalResults && hasStem) base = await tmdb(key, type, stemQ, page);
        const list = base.results.filter((m) => m && Number.isInteger(m.id) && kind.ok(m));
        return Response.json(
          { results: list.map((m) => kind.out(m, simOf(m))), page, totalPages: Math.min(Math.max(base.totalPages, page), MAX_PAGE) },
          { headers },
        );
      }

      const [main, byStem, byLong] = await Promise.all([
        tmdb(key, type, q, 1),
        hasStem ? tmdb(key, type, stemQ, 1).catch(() => null) : null,
        longQ && longQ !== stemQ ? tmdb(key, type, longQ, 1).catch(() => null) : null,
      ]);

      // Junta tudo e dá uma nota para cada filme: parecido com o digitado, achado pela
      // busca exata (na ordem do TMDB) e popular.
      const scored = new Map();
      const add = (list, exact) =>
        list.forEach((m, i) => {
          if (!m || !Number.isInteger(m.id) || !kind.ok(m)) return;
          const sim = simOf(m);
          // Achado só pelo radical: precisa se parecer bastante com o que foi digitado
          if (!exact && sim < 0.6) return;
          const pop = Math.min(1, Math.log10(1 + (m.popularity || 0)) / 3);
          const score = sim * 0.7 + (exact ? 0.15 * (1 - i / 20) : 0) + pop * 0.15;
          const prev = scored.get(m.id);
          if (!prev || prev.score < score) scored.set(m.id, { m, score, sim });
        });
      add(main.results, true);
      if (byStem) add(byStem.results, false);
      if (byLong) add(byLong.results, false);

      const results = [...scored.values()].sort((a, b) => b.score - a.score).map((x) => kind.out(x.m, x.sim));
      // As próximas páginas seguem a busca principal (ou a dos radicais, se a principal veio vazia)
      const total = main.totalResults ? main.totalPages : byStem?.totalPages || 1;
      return Response.json({ results, page: 1, totalPages: Math.min(Math.max(total, 1), MAX_PAGE) }, { headers });
    } catch {
      return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: 502 });
    }
  },
};
