// Teste da função /api/login com um Supabase falso. Uso: node tests/login-api.mjs
import login from "../api/login.js";

const users = { bia: { id: "u1", email: "bia@x.com", password: "123456" } };
const calls = [];
globalThis.fetch = async (url, opt = {}) => {
  calls.push({ url: String(url), headers: opt.headers || {} });
  const u = new URL(url);
  if (u.pathname === "/rest/v1/profiles") {
    const name = u.searchParams.get("username").replace("eq.", "");
    return Response.json(users[name] ? [{ id: users[name].id }] : []);
  }
  if (u.pathname.startsWith("/auth/v1/admin/users/")) {
    const id = u.pathname.split("/").pop();
    const user = Object.values(users).find((x) => x.id === id);
    return user ? Response.json({ id, email: user.email }) : new Response("", { status: 404 });
  }
  if (u.pathname === "/auth/v1/token") {
    const b = JSON.parse(opt.body);
    const ok = Object.values(users).some((x) => x.email === b.email && x.password === b.password);
    return ok
      ? Response.json({ access_token: "at", refresh_token: "rt", user: {} })
      : Response.json({ error_code: "invalid_credentials" }, { status: 400 });
  }
  throw new Error("chamada inesperada " + url);
};

const call = (body, method = "POST") =>
  login.fetch(new Request("https://x/api/login", { method, body: method === "POST" ? JSON.stringify(body) : undefined }));
let fails = 0;
const check = async (name, res, status, test) => {
  const d = await res.json().catch(() => ({}));
  const ok = res.status === status && test(d);
  console.log((ok ? "ok   " : "FAIL ") + name, ok ? "" : JSON.stringify({ status: res.status, d }));
  if (!ok) fails++;
  return d;
};

delete process.env.SUPABASE_SECRET_KEY;
await check("sem a chave secreta avisa", await call({ username: "bia", password: "123456" }), 500, (d) => d.error.includes("SUPABASE_SECRET_KEY"));
process.env.SUPABASE_SECRET_KEY = "sb_secret_teste";
const d = await check("@ e senha certos devolvem a sessão", await call({ username: "@Bia", password: "123456" }), 200, (d) => d.access_token === "at" && d.refresh_token === "rt");
await check("a resposta não mostra o e-mail", new Response(JSON.stringify(d), { status: 200 }), 200, (x) => !JSON.stringify(x).includes("bia@x.com"));
await check("senha errada", await call({ username: "bia", password: "errada" }), 400, (d) => d.error === "invalid_login");
await check("@ que não existe dá o mesmo erro", await call({ username: "ninguem", password: "123456" }), 400, (d) => d.error === "invalid_login");
await check("@ inválido", await call({ username: "a b", password: "123456" }), 400, (d) => d.error === "invalid_login");
await check("GET não é aceito", await call(null, "GET"), 405, () => true);
const admin = calls.find((c) => c.url.includes("/admin/"));
console.log((admin.headers.apikey === "sb_secret_teste" ? "ok   " : "FAIL ") + "chave secreta só nas chamadas de servidor");
if (admin.headers.apikey !== "sb_secret_teste") fails++;
const tok = calls.find((c) => c.url.includes("/token"));
console.log((!JSON.stringify(tok.headers).includes("sb_secret") ? "ok   " : "FAIL ") + "o login usa a chave pública");
console.log(fails ? `\n${fails} falha(s)` : "\nFALHAS: nenhuma");
process.exit(fails ? 1 : 0);
