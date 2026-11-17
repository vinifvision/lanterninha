// Função do servidor (Vercel). Listas de filmes para a tela Início.
// ?list=now (em cartaz no Brasil) | trending (em alta na semana) | classics (clássicos bem avaliados) | similar&id=123 (parecidos com um filme)
const LISTS = {
  now: () => '/movie/now_playing?region=BR',
  trending: () => '/trending/movie/week?',
  classics: () => '/discover/movie?sort_by=vote_count.desc&vote_average.gte=7.8&vote_count.gte=3000&primary_release_date.lte=1989-12-31&page=' + (1 + Math.floor(Math.random() * 3)),
  similar: (id) => '/movie/' + id + '/recommendations?',
};

export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const list = params.get('list') || '';
    const id = params.get('id') || '';
    if (!LISTS[list]) return Response.json({ error: 'lista inválida' }, { status: 400 });
    if (list === 'similar' && !/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const path = LISTS[list](id);
    const url = 'https://api.themoviedb.org/3' + path + (path.endsWith('?') ? '' : '&')
      + 'language=pt-BR&include_adult=false&api_key=' + encodeURIComponent(key);
    const r = await fetch(url);
    if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: 502 });

    const data = await r.json();
    const results = (data.results || [])
      .filter((m) => m.poster_path)
      .slice(0, 14)
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
