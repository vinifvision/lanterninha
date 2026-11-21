// Função do servidor (Vercel). Listas de filmes para a tela Início e a aba Buscar.
// ?list=now (em cartaz no Brasil) | trending (em alta na semana) | classics (clássicos bem avaliados) | similar&id=123 (parecidos com um filme)
// | mood&m=chorar|rir|br|curto (Explorar por clima, na aba Buscar: por gênero, país e duração)
// &page=N (opcional, 1 a 500): a página do TMDB. A ordem é fixa, então a página 2 continua a 1 sem repetir.
const MOODS = {
  chorar: '/discover/movie?with_genres=18&without_genres=35&sort_by=vote_count.desc&vote_average.gte=7.5&vote_count.gte=1500',
  rir: '/discover/movie?with_genres=35&sort_by=vote_count.desc&vote_average.gte=7&vote_count.gte=1500',
  br: '/discover/movie?with_origin_country=BR&with_original_language=pt&sort_by=vote_count.desc&vote_count.gte=80',
  curto: '/discover/movie?with_runtime.gte=60&with_runtime.lte=100&sort_by=vote_count.desc&vote_average.gte=7.3&vote_count.gte=2000',
};
const LISTS = {
  now: () => '/movie/now_playing?region=BR',
  trending: () => '/trending/movie/week',
  classics: () => '/discover/movie?sort_by=vote_count.desc&vote_average.gte=7.8&vote_count.gte=3000&primary_release_date.lte=1989-12-31',
  similar: (id) => '/movie/' + id + '/recommendations',
  mood: (_, m) => MOODS[m],
};
// O TMDB não entrega além da página 500
const MAX_PAGE = 500;

export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const list = params.get('list') || '';
    const id = params.get('id') || '';
    const m = params.get('m') || '';
    const pageRaw = params.get('page') || '1';
    if (!Object.hasOwn(LISTS, list)) return Response.json({ error: 'lista inválida' }, { status: 400 });
    if (list === 'similar' && !/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });
    if (list === 'mood' && !Object.hasOwn(MOODS, m)) return Response.json({ error: 'clima inválido' }, { status: 400 });
    const page = /^\d{1,3}$/.test(pageRaw) ? Number(pageRaw) : 0;
    if (page < 1 || page > MAX_PAGE) return Response.json({ error: 'página inválida' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const path = LISTS[list](id, m);
    const url = 'https://api.themoviedb.org/3' + path + (path.includes('?') ? '&' : '?')
      + 'page=' + page + '&language=pt-BR&include_adult=false&api_key=' + encodeURIComponent(key);
    const r = await fetch(url);
    if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: 502 });

    const data = await r.json();
    const results = (data.results || [])
      .filter((x) => x.poster_path)
      .map((x) => ({
        id: x.id,
        title: x.title,
        original: x.original_title,
        year: (x.release_date || '').slice(0, 4),
        poster: x.poster_path || '',
      }));
    const total = Number.isInteger(data.total_pages) ? data.total_pages : page;

    // As listas mudam pouco ao longo do dia: o resultado fica guardado por 6 horas
    return Response.json(
      { results, page, totalPages: Math.min(Math.max(total, page), MAX_PAGE) },
      { headers: { 'Cache-Control': 'public, s-maxage=21600' } },
    );
  },
};
