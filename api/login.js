// Função do servidor (Vercel). Entrar com o @: recebe o @ e a senha, acha o e-mail dessa conta
// e faz o login no Supabase. O e-mail nunca sai daqui: o app recebe só a sessão.
// Precisa da variável de ambiente SUPABASE_SECRET_KEY (a chave secreta do Supabase),
// configurada no painel da Vercel. Essa chave passa por cima das regras do banco: nunca vai para o app.
const SUPABASE_URL = "https://diyqoytezequhjzobxpi.supabase.co";
const PUBLIC_KEY = "sb_publishable_2e2wmfwPRpExRQ_KMrqBfQ_V_VumbRg";

/** Mesma resposta para "@ não existe" e "senha errada", para não entregar quais @ existem. */
const wrong = () => Response.json({ error: "invalid_login" }, { status: 400 });

export default {
  async fetch(request) {
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    if (request.method !== "POST")
      return Response.json({ error: "use POST" }, { status: 405 });

    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret)
      return Response.json(
        { error: "SUPABASE_SECRET_KEY não configurada" },
        { status: 500 },
      );

    let body = null;
    try {
      body = JSON.parse(await request.text());
    } catch {
      /* corpo inválido */
    }
    const name = String(body?.username || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    const password = String(body?.password || "");
    if (!/^[a-z0-9_.]{3,20}$/.test(name) || !password) return wrong();

    // A chave secreta vai nos dois cabeçalhos com o mesmo valor (o Supabase aceita assim).
    const admin = { apikey: secret, Authorization: "Bearer " + secret };
    try {
      // 1) @ → id da conta
      const p = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(name)}&limit=1`,
        { headers: admin },
      );
      if (!p.ok) return Response.json({ error: "server" }, { status: 502 });
      const id = (await p.json())[0]?.id;
      if (!id) return wrong();

      // 2) id → e-mail
      const u = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        headers: admin,
      });
      if (!u.ok) return Response.json({ error: "server" }, { status: 502 });
      const email = (await u.json()).email;
      if (!email) return wrong();

      // 3) e-mail + senha → sessão (o mesmo login que o app faz com o e-mail)
      const t = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const s = await t.json().catch(() => ({}));
      if (t.ok && s.access_token)
        return Response.json(
          { access_token: s.access_token, refresh_token: s.refresh_token },
          { headers: { "Cache-Control": "no-store" } },
        );
      if (t.status === 429) return Response.json({ error: "rate" }, { status: 429 });
      if (s.error_code === "email_not_confirmed")
        return Response.json({ error: "not_confirmed" }, { status: 400 });
      return wrong();
    } catch {
      return Response.json({ error: "server" }, { status: 502 });
    }
  },
};
