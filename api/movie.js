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
      "?language=pt-BR&append_to_response=credits,watch/providers,videos&include_video_language=pt-BR,pt,en&api_key=" +
      encodeURIComponent(key);
    const r = await fetch(url);
    if (!r.ok)
      return Response.json(
        { error: "Falha ao consultar o TMDB" },
        { status: r.status === 404 ? 404 : 502 },
      );

    const m = await r.json();
    const directors = ((m.credits && m.credits.crew) || [])
      .filter((p) => p.job === "Director")
      .slice(0, 2)
      .map((p) => ({ id: p.id, name: p.name }));
    const director = directors.map((p) => p.name).join(", ");
    // Produtoras (ex.: Marvel Studios, Neon), para abrir a página de cada uma
    const companies = (m.production_companies || [])
      .slice(0, 4)
      .map((c) => ({ id: c.id, name: c.name, logo: c.logo_path || "" }));

    // Elenco principal e trailer (prefere o trailer em português)
    const cast = ((m.credits && m.credits.cast) || [])
      .slice(0, 5)
      .map((p) => p.name);
    const vids = ((m.videos && m.videos.results) || []).filter(
      (v) => v.site === "YouTube" && v.type === "Trailer",
    );
    const pick =
      vids.find((v) => v.iso_639_1 === "pt") ||
      vids.find((v) => v.official) ||
      vids[0];

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

    // Se o filme faz parte de uma série (ex.: trilogia), busca os filmes dela em ordem de lançamento
    let collection = null;
    const col = m.belongs_to_collection;
    if (col && col.id) {
      const cr = await fetch(
        "https://api.themoviedb.org/3/collection/" +
          col.id +
          "?language=pt-BR&api_key=" +
          encodeURIComponent(key),
      ).catch(() => null);
      if (cr && cr.ok) {
        const c = await cr.json();
        const parts = (c.parts || [])
          .filter((p) => p.release_date)
          .sort((a, b) => a.release_date.localeCompare(b.release_date))
          .map((p) => ({
            id: p.id,
            title: p.title || "",
            year: p.release_date.slice(0, 4),
            poster: p.poster_path || "",
          }));
        if (parts.length > 1) collection = { name: c.name || col.name || "", parts };
      }
    }

    return Response.json(
      {
        overview: m.overview || "",
        runtime: m.runtime || 0,
        // Nota do público no TMDB (0 a 10), só com votos suficientes
        vote: m.vote_count >= 20 ? Math.round(m.vote_average * 10) / 10 : null,
        release: m.release_date || "",
        genres: (m.genres || []).map((g) => g.name).slice(0, 3),
        genreIds: (m.genres || []).map((g) => g.id),
        director,
        directors,
        companies,
        backdrop: m.backdrop_path || "",
        cast,
        trailer: pick ? pick.key : "",
        providers: {
          stream: list(br.flatrate),
          rent: list(br.rent),
          buy: list(br.buy),
        },
        collection,
      },
      { headers: { "Cache-Control": "public, s-maxage=604800" } },
    );
  },
};
