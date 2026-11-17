// Função do servidor (Vercel). Recebe ?id=123 e devolve as imagens de fundo (cenas) do filme, para o banner do perfil.
export default {
  async fetch(request) {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    // include_image_language=null traz as imagens sem texto por cima (as mais bonitas para banner)
    const r = await fetch('https://api.themoviedb.org/3/movie/' + id + '/images?include_image_language=null&api_key=' + encodeURIComponent(key));
    if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: r.status === 404 ? 404 : 502 });

    const data = await r.json();
    const backdrops = (data.backdrops || [])
      .filter((b) => b.file_path && b.width >= 1000)
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 18)
      .map((b) => b.file_path);

    return Response.json({ backdrops }, { headers: { 'Cache-Control': 'public, s-maxage=604800' } });
  },
};
