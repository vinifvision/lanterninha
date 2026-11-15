// Função do servidor (Vercel). Recebe ?id=123 e devolve os detalhes do filme no TMDB.
export default {
  async fetch(request) {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^\d{1,9}$/.test(id))
      return Response.json({ error: "id inválido" }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key)
      return Response.json(
        { error: "TMDB_KEY não configurada" },
        { status: 500 },
      );

    const url =
      "https://api.themoviedb.org/3/movie/" +
      id +
      "?language=pt-BR&append_to_response=credits&api_key=" +
      encodeURIComponent(key);
    const r = await fetch(url);
    if (!r.ok)
      return Response.json(
        { error: "Falha ao consultar o TMDB" },
        { status: r.status === 404 ? 404 : 502 },
      );

    const m = await r.json();
    const director = ((m.credits && m.credits.crew) || [])
      .filter((p) => p.job === "Director")
      .map((p) => p.name)
      .slice(0, 2)
      .join(", ");

    return Response.json(
      {
        overview: m.overview || "",
        runtime: m.runtime || 0,
        genres: (m.genres || []).map((g) => g.name).slice(0, 3),
        director,
        backdrop: m.backdrop_path || "",
      },
      { headers: { "Cache-Control": "public, s-maxage=604800" } },
    );
  },
};
