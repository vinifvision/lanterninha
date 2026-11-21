// Função do servidor (Vercel). Página de uma pessoa ou de uma produtora: quem é e todos os filmes dela.
// ?type=person&id=123 (diretor, ator, roteirista...) | ?type=company&id=420 (ex.: Marvel Studios)
const JOBS = {
  Director: 'Direção',
  Screenplay: 'Roteiro', Writer: 'Roteiro', Story: 'Roteiro',
  Producer: 'Produção',
  'Director of Photography': 'Fotografia',
  Editor: 'Montagem',
  'Original Music Composer': 'Trilha sonora', Music: 'Trilha sonora',
  'Production Design': 'Design de produção',
  'Costume Design': 'Figurino',
};
const KNOWN = {
  Acting: 'Atuação', Directing: 'Direção', Writing: 'Roteiro', Production: 'Produção', Camera: 'Fotografia',
  Editing: 'Montagem', Sound: 'Trilha sonora', Art: 'Design de produção', 'Costume & Make-Up': 'Figurino',
};
// Aparições como "ele mesmo" (documentários, bastidores) poluem a lista de quem atua
const SELF = /^(self|himself|herself|themselves|ele mesmo|ela mesma|\(voice\)$)/i;
const COMPANY_PAGES = 5; // até 100 filmes, dos mais populares para os menos

const tmdb = (path, key) =>
  fetch('https://api.themoviedb.org/3' + path + (path.includes('?') ? '&' : '?') + 'language=pt-BR&api_key=' + encodeURIComponent(key));

const film = (m) => ({
  id: m.id,
  title: m.title || '',
  original: m.original_title || '',
  year: (m.release_date || '').slice(0, 4),
  date: m.release_date || '',
  poster: m.poster_path || '',
  pop: Math.round((m.popularity || 0) * 10) / 10,
  votes: m.vote_count || 0,
});

async function person(id, key) {
  const r = await tmdb('/person/' + id + '?append_to_response=movie_credits', key);
  if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: r.status === 404 ? 404 : 502 });
  const p = await r.json();
  const c = p.movie_credits || {};
  const byId = new Map();
  const add = (m, role) => {
    if (!m || !m.id || !m.title) return;
    let f = byId.get(m.id);
    if (!f) { f = { ...film(m), roles: [] }; byId.set(m.id, f); }
    if (!f.roles.includes(role)) f.roles.push(role);
  };
  for (const m of c.cast || []) {
    if (SELF.test((m.character || '').trim())) continue;
    add(m, 'Atuação');
  }
  for (const m of c.crew || []) if (JOBS[m.job]) add(m, JOBS[m.job]);
  // Sem pôster e sem data costuma ser projeto que nem existe ainda
  const films = [...byId.values()].filter((f) => f.poster || f.date);
  films.sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'));
  return Response.json({
    name: p.name || '',
    photo: p.profile_path || '',
    known: KNOWN[p.known_for_department] || '',
    films: films.slice(0, 300),
  }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
}

async function company(id, key) {
  const [info, ...pages] = await Promise.all([
    tmdb('/company/' + id, key),
    ...Array.from({ length: COMPANY_PAGES }, (_, i) =>
      tmdb('/discover/movie?with_companies=' + id + '&sort_by=popularity.desc&include_adult=false&page=' + (i + 1), key)),
  ]);
  if (!info.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: info.status === 404 ? 404 : 502 });
  const c = await info.json();
  const seen = new Set();
  const films = [];
  let total = 0;
  for (const r of pages) {
    if (!r.ok) break;
    const d = await r.json();
    total = Math.max(total, d.total_results || 0);
    for (const m of d.results || []) {
      if (!m.id || !m.title || seen.has(m.id) || !(m.poster_path || m.release_date)) continue;
      seen.add(m.id);
      films.push({ ...film(m), roles: [] });
    }
    if ((d.page || 0) >= (d.total_pages || 0)) break;
  }
  return Response.json({
    name: c.name || '',
    photo: c.logo_path || '',
    known: 'Produtora',
    total: Math.max(total, films.length),
    films,
  }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
}

export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const type = params.get('type') || '';
    const id = params.get('id') || '';
    if (type !== 'person' && type !== 'company') return Response.json({ error: 'tipo inválido' }, { status: 400 });
    if (!/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });
    return type === 'person' ? person(id, key) : company(id, key);
  },
};
