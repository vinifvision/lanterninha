// Função do servidor (Vercel). Repassa um pôster do TMDB pelo próprio site,
// para o app conseguir desenhar a imagem de compartilhar. Uso: /api/img?size=w500&path=/abc.jpg
const SIZES = ["w342", "w500", "w780"];

export default {
  async fetch(request) {
    const p = new URL(request.url).searchParams;
    const path = p.get("path") || "";
    const size = SIZES.includes(p.get("size")) ? p.get("size") : "w500";
    if (!/^\/[\w.-]+\.(jpg|jpeg|png)$/i.test(path))
      return new Response("caminho inválido", { status: 400 });

    const r = await fetch("https://image.tmdb.org/t/p/" + size + path);
    if (!r.ok) return new Response("imagem não encontrada", { status: 404 });

    return new Response(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      },
    });
  },
};
