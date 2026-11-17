// Função do servidor (Vercel). Filmes de sucesso de um período, para o Baú da infância.
// Recebe ?from=1998&to=2008 e mistura: animações e filmes de família, grandes sucessos e filmes brasileiros.
export default {
  async fetch(request) {
    const q = new URL(request.url).searchParams;
    const from = Number(q.get('from')), to = Number(q.get('to'));
    const now = new Date().getFullYear();
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1930 || to > now || to < from || to - from > 12) {
      return Response.json({ error: 'período inválido' }, { status: 400 });
    }
    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const base = 'https://api.themoviedb.org/3/discover/movie?language=pt-BR&include_adult=false'
      + '&primary_release_date.gte=' + from + '-01-01&primary_release_date.lte=' + to + '-12-31&api_key=' + encodeURIComponent(key);
    const get = (extra, page) => fetch(base + extra + '&page=' + page).then((r) => (r.ok ? r.json() : { results: [] })).then((d) => d.results || []).catch(() => []);

    // Sem terror (27): a ideia é o que passava para criança e na TV aberta
    const [fam1, fam2, fam3, hit1, hit2, br1, br2] = await Promise.all([
      get('&with_genres=16|10751&sort_by=vote_count.desc', 1),
      get('&with_genres=16|10751&sort_by=vote_count.desc', 2),
      get('&with_genres=16|10751&sort_by=vote_count.desc', 3),
      get('&without_genres=27&sort_by=revenue.desc', 1),
      get('&without_genres=27&sort_by=revenue.desc', 2),
      get('&with_origin_country=BR&without_genres=27&sort_by=vote_count.desc', 1),
      get('&with_origin_country=BR&without_genres=27&sort_by=vote_count.desc', 2),
    ]);
    const fam = [...fam1, ...fam2, ...fam3], hit = [...hit1, ...hit2], br = [...br1, ...br2];

    // Intercala: 2 de família, 1 sucesso, 1 brasileiro, até acabar
    const out = [], seen = new Set();
    const push = (m) => { if (!m || seen.has(m.id) || !m.poster_path) return; seen.add(m.id); out.push(m); };
    for (let i = 0; out.length < 140 && (i < fam.length || i < hit.length || i < br.length); i++) {
      push(fam[2 * i]); push(fam[2 * i + 1]); push(hit[i]); push(br[i]);
    }

    const results = out.map((m) => ({
      id: m.id, title: m.title, original: m.original_title, year: (m.release_date || '').slice(0, 4), poster: m.poster_path || '',
    }));
    return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=604800' } });
  },
};
