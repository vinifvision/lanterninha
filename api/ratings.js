// Função do servidor (Vercel). Recebe ?id=123 (TMDB) e devolve as notas do filme em outras plataformas.
// IMDb, Rotten Tomatoes e Metacritic vêm da OMDb (chave OMDB_KEY no painel da Vercel).
// A nota do TMDB vai junto, para quando a OMDb não tiver o filme ou a chave não estiver configurada.
export default {
  async fetch(request) {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const r = await fetch('https://api.themoviedb.org/3/movie/' + id + '?api_key=' + encodeURIComponent(key));
    if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: r.status === 404 ? 404 : 502 });
    const m = await r.json();

    const out = {
      imdbId: /^tt\d{5,10}$/.test(m.imdb_id || '') ? m.imdb_id : '',
      tmdb: m.vote_count >= 20 ? Math.round(m.vote_average * 10) / 10 : null,
      imdb: null, rt: null, mc: null,
    };

    const omdb = process.env.OMDB_KEY;
    if (omdb && out.imdbId) {
      try {
        const o = await (await fetch('https://www.omdbapi.com/?i=' + out.imdbId + '&apikey=' + encodeURIComponent(omdb))).json();
        if (o.Response === 'True') {
          const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
          out.imdb = num(o.imdbRating);
          const rt = (o.Ratings || []).find((x) => x.Source === 'Rotten Tomatoes');
          out.rt = rt ? num(rt.Value) : null;
          out.mc = num(o.Metascore);
        }
      } catch { /* segue só com o TMDB */ }
    }

    // As notas mudam pouco: guardadas por um dia, o que poupa o limite diário da OMDb
    return Response.json(out, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  },
};
