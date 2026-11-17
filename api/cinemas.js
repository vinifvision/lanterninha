// Função do servidor (Vercel). Cinemas reais perto de um ponto, a partir do OpenStreetMap (gratuito),
// pelo Nominatim (a busca oficial do OpenStreetMap). Recebe ?lat=-8.05&lon=-34.90.
// O app já manda a posição arredondada (uns 1 km), e nada é guardado.
export default {
  async fetch(request) {
    const q = new URL(request.url).searchParams;
    const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return Response.json({ error: 'posição inválida' }, { status: 400 });
    }
    // Um quadrado de uns 25 km para cada lado em volta da pessoa
    const d = 0.23;
    const box = [lon - d, lat + d, lon + d, lat - d].map((n) => n.toFixed(3)).join(',');
    const url = `https://nominatim.openstreetmap.org/search?amenity=cinema&viewbox=${box}&bounded=1&format=jsonv2&addressdetails=1&limit=40&accept-language=pt-BR`;
    let data;
    try {
      // O Nominatim pede que cada app se identifique
      const r = await fetch(url, { headers: { 'User-Agent': 'Lanterninha/1.1 (https://lanterninha.vercel.app)', Referer: 'https://lanterninha.vercel.app/' } });
      if (!r.ok) throw new Error(String(r.status));
      data = await r.json();
    } catch (e) {
      return Response.json({ error: 'Não consegui buscar os cinemas agora', detail: String(e && e.message || e) }, { status: 502 });
    }

    // Distância em km entre dois pontos
    const km = (a, b, c, e) => {
      const rad = Math.PI / 180, x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((e - b) * rad) / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(x));
    };
    const seen = new Set();
    const cinemas = (Array.isArray(data) ? data : []).map((c) => {
      const y = Number(c.lat), x = Number(c.lon), a = c.address || {};
      if (!c.name || !Number.isFinite(y) || !Number.isFinite(x)) return null;
      const place = [a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(', ');
      return { name: String(c.name).slice(0, 60), place: place.slice(0, 60), km: Math.round(km(lat, lon, y, x) * 10) / 10 };
    }).filter((c) => c && !seen.has(c.name) && seen.add(c.name)).sort((p, n) => p.km - n.km).slice(0, 25);

    return Response.json({ cinemas }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  },
};
