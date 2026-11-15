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
      "?language=pt-BR&append_to_response=credits,watch/providers&api_key=" +
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

    // Onde assistir no Brasil (o TMDB recebe esses dados da JustWatch)
    const br =
      (m["watch/providers"] &&
        m["watch/providers"].results &&
        m["watch/providers"].results.BR) ||
      {};
    const list = (a) =>
      (a || [])
        .slice(0, 6)
        .map((x) => ({ name: x.provider_name, logo: x.logo_path || "" }));

    return Response.json(
      {
        overview: m.overview || "",
        runtime: m.runtime || 0,
        genres: (m.genres || []).map((g) => g.name).slice(0, 3),
        director,
        backdrop: m.backdrop_path || "",
        providers: {
          stream: list(br.flatrate),
          rent: list(br.rent),
          buy: list(br.buy),
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=604800" } },
    );
  },
};
