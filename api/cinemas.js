// Função do servidor (Vercel). Cinemas reais perto de um ponto, a partir do OpenStreetMap (gratuito).
// Recebe ?lat=-8.05&lon=-34.90. O app já manda a posição arredondada (uns 1 km), e nada é guardado.
export default {
  async fetch(request) {
    const q = new URL(request.url).searchParams;
    const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return Response.json({ error: 'posição inválida' }, { status: 400 });
    }
    const la = lat.toFixed(2), lo = lon.toFixed(2);
    const query = `[out:json][timeout:15];nwr["amenity"="cinema"](around:25000,${la},${lo});out center tags 60;`;
    let data;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Lanterninha/1.0 (lanterninha.vercel.app)' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!r.ok) throw new Error(String(r.status));
      data = await r.json();
    } catch {
      return Response.json({ error: 'Não consegui buscar os cinemas agora' }, { status: 502 });
    }

    // Distância em km entre dois pontos
    const km = (a, b, c, d) => {
      const rad = Math.PI / 180, x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(x));
    };
    const seen = new Set();
    const cinemas = (data.elements || []).map((e) => {
      const t = e.tags || {};
      const y = e.lat ?? (e.center && e.center.lat), x = e.lon ?? (e.center && e.center.lon);
      if (!t.name || y == null || x == null) return null;
      // Junta a rede ao nome quando ela não aparece nele (ex.: "Cinemark" + "RioMar")
      const brand = t.brand || t.operator || '';
      const name = brand && !t.name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${t.name}` : t.name;
      const place = [t['addr:suburb'], t['addr:city']].filter(Boolean).join(', ');
      return { name: name.slice(0, 60), place: place.slice(0, 60), km: Math.round(km(lat, lon, y, x) * 10) / 10 };
    }).filter((c) => c && !seen.has(c.name) && seen.add(c.name)).sort((a, b) => a.km - b.km).slice(0, 25);

    return Response.json({ cinemas }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  },
};
