// Função do servidor (Vercel). Listas de filmes para a tela Início.
// ?list=now (em cartaz no Brasil) | trending (em alta na semana) | classics (clássicos bem avaliados) | similar&id=123 (parecidos com um filme)
// | mood&m=chorar|rir|br|curto (Explorar por clima, na aba Buscar: por gênero, país e duração)
const page = () => 1 + Math.floor(Math.random() * 3);
const MOODS = {
  chorar: () => '/discover/movie?with_genres=18&without_genres=35&sort_by=vote_count.desc&vote_average.gte=7.5&vote_count.gte=1500&page=' + page(),
  rir: () => '/discover/movie?with_genres=35&sort_by=vote_count.desc&vote_average.gte=7&vote_count.gte=1500&page=' + page(),
  br: () => '/discover/movie?with_origin_country=BR&with_original_language=pt&sort_by=vote_count.desc&vote_count.gte=80&page=' + page(),
  curto: () => '/discover/movie?with_runtime.gte=60&with_runtime.lte=100&sort_by=vote_count.desc&vote_average.gte=7.3&vote_count.gte=2000&page=' + page(),
};
const LISTS = {
  now: () => '/movie/now_playing?region=BR',
  trending: () => '/trending/movie/week?',
  classics: () => '/discover/movie?sort_by=vote_count.desc&vote_average.gte=7.8&vote_count.gte=3000&primary_release_date.lte=1989-12-31&page=' + (1 + Math.floor(Math.random() * 3)),
  similar: (id) => '/movie/' + id + '/recommendations?',
  mood: (_, m) => MOODS[m](),
};

export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const list = params.get('list') || '';
    const id = params.get('id') || '';
    const m = params.get('m') || '';
    if (!LISTS[list]) return Response.json({ error: 'lista inválida' }, { status: 400 });
    if (list === 'similar' && !/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });
    if (list === 'mood' && !Object.hasOwn(MOODS, m)) return Response.json({ error: 'clima inválido' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const path = LISTS[list](id, m);
    const url = 'https://api.themoviedb.org/3' + path + (path.endsWith('?') ? '' : '&')
      + 'language=pt-BR&include_adult=false&api_key=' + encodeURIComponent(key);
    const r = await fetch(url);
    if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: 502 });

    const data = await r.json();
    const results = (data.results || [])
      .filter((m) => m.poster_path)
      .slice(0, list === 'mood' ? 18 : 14)
      .map((m) => ({
        id: m.id,
        title: m.title,
        original: m.original_title,
        year: (m.release_date || '').slice(0, 4),
        poster: m.poster_path || '',
      }));

    // Em cartaz e em alta mudam pouco ao longo do dia: o resultado fica guardado por 6 horas
    return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=21600' } });
  },
};
