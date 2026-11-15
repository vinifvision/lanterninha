// Função do servidor (Vercel). Recebe ?q=nome, consulta o TMDB e devolve até 5 filmes.
// A chave vem da variável de ambiente TMDB_KEY, configurada no painel da Vercel.
export default {
  async fetch(request) {
    const q = (new URL(request.url).searchParams.get("q") || "")
      .trim()
      .slice(0, 80);
    if (q.length < 2) return Response.json({ results: [] });

    const key = process.env.TMDB_KEY;
    if (!key)
      return Response.json(
        { error: "TMDB_KEY não configurada" },
        { status: 500 },
      );

    const url =
      "https://api.themoviedb.org/3/search/movie?language=pt-BR&include_adult=false" +
      "&api_key=" +
      encodeURIComponent(key) +
      "&query=" +
      encodeURIComponent(q);
    const r = await fetch(url);
    if (!r.ok)
      return Response.json(
        { error: "Falha ao consultar o TMDB" },
        { status: 502 },
      );

    const data = await r.json();
    const results = (data.results || []).slice(0, 5).map((m) => ({
      id: m.id,
      title: m.title,
      original: m.original_title,
      year: (m.release_date || "").slice(0, 4),
      poster: m.poster_path || "",
    }));

    return Response.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=86400" } },
    );
  },
};
