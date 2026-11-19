// Aba Você: entrar ou criar conta; depois, o perfil com Top 4, Seu ano, visto recentemente, amigos e placar.
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Banner } from "../components/Banner";
import { FriendRow } from "../components/FriendRow";
import { useAsync } from "../components/hooks";
import { Poster } from "../components/Poster";
import { useRefresh } from "../lib/refresh";
import { TopFour } from "../components/TopFour";
import { cleanProfile, cloud, useCloud } from "../lib/cloud";
import { fkey, isRated, useFilms } from "../lib/films";
import { byDiary } from "./Diary";
import { fmt, MONTHS } from "../lib/format";
import type { Film, Profile as ProfileData } from "../lib/types";
import { nav } from "../nav";
import { Ticket } from "../components/Ticket";
import { ChestIcon } from "../components/icons";

const EMPTY_PROFILE = cleanProfile({}) as ProfileData;

export function Profile() {
  const account = useCloud();
  if (!account.ready) {
    return (
      <div className="screen">
        <h1>Perfil</h1>
        <p className="count">Conectando…</p>
        <p className="empty">Se isso não mudar, confira sua internet.</p>
      </div>
    );
  }
  return account.user ? <Account /> : <AuthForm />;
}

type AuthMode = "in" | "reset";

function AuthForm() {
  const account = useCloud();
  // Se a pessoa chegou por um link vencido do e-mail, já abre no "Esqueci minha senha" com o aviso
  const [mode, setMode] = useState<AuthMode>(account.linkError ? "reset" : "in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(
    account.linkError ? { t: account.linkError, bad: true } : null,
  );
  /** E-mail para onde o link de senha nova foi mandado */
  const [sentTo, setSentTo] = useState("");
  /** Segundos até poder reenviar o link (o Supabase só aceita um pedido por minuto) */
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (account.linkError) cloud.linkErrorShown();
  }, []);
  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  const bad = (t: string) => setMsg({ t, bad: true });
  const go = (m: AuthMode) => {
    setMode(m);
    setMsg(null);
    setSentTo("");
  };

  const sendLink = async (mail: string) => {
    setBusy(true);
    setMsg({ t: "Enviando…" });
    const r = await cloud.sendReset(mail);
    setBusy(false);
    if (r) return bad(r);
    setMsg(null);
    setSentTo(mail);
    setWait(60);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();
    // No "Entrar" vale o e-mail ou o @ (com ou sem o @ na frente)
    const byName = mode === "in" && !mail.replace(/^@/, "").includes("@");
    if (byName && !/^@?[a-z0-9_.]{3,20}$/i.test(mail))
      return bad(mail ? "Esse @ não parece certo." : "Digite seu e-mail ou seu @.");
    if (!byName && !/^\S+@\S+\.\S+$/.test(mail))
      return bad("Esse e-mail não parece válido.");
    if (mode === "reset") return sendLink(mail);
    if (pw.length < 6)
      return bad("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    setMsg({ t: "Entrando…" });
    const r = await cloud.signIn(mail, pw);
    setBusy(false);
    if (r) bad(r);
  };

  const emailInput = (
    <input
      // No "Entrar" o campo aceita e-mail ou @; o teclado continua com a tecla @ à mão
      type={mode === "in" ? "text" : "email"}
      inputMode="email"
      id="em"
      placeholder={mode === "in" ? "E-mail ou @usuário" : "E-mail"}
      autoComplete={mode === "in" ? "username" : "email"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  );
  const message = (
    <p className={`fmsg${msg?.bad ? " bad" : ""}`} id="fm">
      {msg ? msg.t : ""}
    </p>
  );

  if (mode === "reset")
    return (
      <div className="screen">
        <h1>Perfil</h1>
        <p className="count">Esqueceu a senha? Acontece.</p>
        {sentTo ? (
          <div className="rsent" id="rsent">
            <div className="rsent-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 7 8 6 8-6" />
              </svg>
            </div>
            <b>Confira seu e-mail</b>
            <p>
              Se <span>{sentTo}</span> tiver conta no Lanterninha, o link para
              criar uma senha nova chega em instantes. Olhe também o spam.
            </p>
            <button
              className="plain"
              id="rre"
              disabled={wait > 0 || busy}
              onClick={() => void sendLink(sentTo)}
            >
              {wait ? `Reenviar em ${wait}s` : "Reenviar link"}
            </button>
          </div>
        ) : (
          <form id="af" noValidate onSubmit={submit}>
            <p className="rlead">
              Digite o e-mail da sua conta. Vamos mandar um link para você criar
              uma senha nova.
            </p>
            {emailInput}
            <button className="cta" id="ago" type="submit" disabled={busy}>
              Enviar link
            </button>
          </form>
        )}
        {message}
        <button className="lnk" id="rback" onClick={() => go("in")}>
          Voltar para entrar
        </button>
      </div>
    );

  return (
    <div className="screen">
      <h1>Perfil</h1>
      <p className="count">
        Entre para guardar seus filmes na conta e ver em qualquer aparelho.
      </p>
      <div className="seg">
        <button data-m="in" className="on" onClick={() => go("in")}>
          Entrar
        </button>
        <button data-m="up" onClick={() => nav.open({ k: "signup" })}>
          Criar conta
        </button>
      </div>
      <form id="af" noValidate onSubmit={submit}>
        {emailInput}
        <input
          type="password"
          id="pw"
          placeholder="Senha"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="cta" id="ago" type="submit" disabled={busy}>
          Entrar
        </button>
      </form>
      {message}
      <button className="lnk" id="forgot" onClick={() => go("reset")}>
        Esqueci minha senha
      </button>
    </div>
  );
}

function Account() {
  const account = useCloud();
  const all = useFilms();
  const user = account.user!;
  const pr = account.profile || EMPTY_PROFILE;
  // Todos os assistidos: os avaliados e os marcados como "Já vi" sem nota
  const watched = all.filter((h) => h.st !== "want");
  const chestN = all.filter((h) => h.b).length;
  const year = String(new Date().getFullYear());
  const thisYear = watched.filter((h) => (h.d || "").startsWith(year));
  const recent = watched.filter((h) => h.d || h.ts).sort(byDiary).slice(0, 4);
  const name =
    pr.display_name || (pr.username ? "@" + pr.username : "Minha conta");
  const [err, setErr] = useState("");

  const openTop = (i: number) => {
    const f = pr.top4[i];
    if (!f) return nav.open({ k: "editProfile" });
    const h = all.find((x) => fkey(x) === fkey(f));
    if (h) nav.openFilm(h);
  };
  const diary = () => nav.push({ k: "diary" });
  return (
    <div className="screen v2pf">
      {pr.banner ? <Banner path={pr.banner} /> : <div className="pbanner v2nob" />}
      <div className="v2pfhead">
        <div className="v2pfrow">
          <Avatar p={pr} fallback={user.email} />
          {account.extended && (
            <button className="v2pill" id="ped" onClick={() => nav.open({ k: "editProfile" })}>
              Editar perfil
            </button>
          )}
        </div>
        <h1 className="v2pfname">{name}</h1>
        {pr.display_name && pr.username && <p className="v2pfsub">@{pr.username}</p>}
      </div>
      {pr.bio && <p className="bio v2bio">{pr.bio}</p>}

      <div className="v2nums">
        <button type="button" id="pfn" onClick={diary}>
          <b>{watched.length}</b>
          <span>{watched.length === 1 ? "filme" : "filmes"}</span>
        </button>
        <i aria-hidden="true" />
        <button type="button" onClick={diary}>
          <b>{thisYear.length}</b>
          <span>em {year}</span>
        </button>
        {account.social && (
          <>
            <i aria-hidden="true" />
            <div>
              <b>{account.friends.list.length}</b>
              <span>{account.friends.list.length === 1 ? "amigo" : "amigos"}</span>
            </div>
          </>
        )}
      </div>

      {account.extended && (
        <>
          <h2 className="v2h">Top 4</h2>
          <TopFour id="t4" top4={pr.top4} empty="+" onPick={openTop} />
        </>
      )}

      <YearCard films={thisYear} year={year} />

      {recent.length > 0 && (
        <>
          <h2 className="v2h">Visto recentemente</h2>
          <div className="v2rec">
            {recent.map((h) => (
              <button key={fkey(h)} onClick={() => nav.openFilm(h)}>
                <span className="v2rpos"><Poster img={h.img} title={h.t} /></span>
                <small>{isRated(h) ? "★ " + fmt(h.s) : "Já vi"}</small>
              </button>
            ))}
          </div>
        </>
      )}

      <nav className="v2links" aria-label="Suas coleções">
        <button onClick={diary}>
          <span>Diário</span>
          <em>{watched.length}</em>
          <i aria-hidden="true">›</i>
        </button>
        <button id="chprof" onClick={() => nav.push({ k: "chest" })}>
          <span className="v2lic"><ChestIcon />Baú da infância</span>
          <em>{chestN || ""}</em>
          <i aria-hidden="true">›</i>
        </button>
      </nav>

      <TicketDrawer />
      {account.social && (
        <>
          <FriendsBlock onError={setErr} />
          <Board />
        </>
      )}
      <p className={`fmsg${err ? " bad" : ""}`} id="fm">
        {err}
      </p>
    </div>
  );
}

/** Seu ano: filmes por mês (o mês mais forte em dourado), a nota que você mais dá e a média. */
function YearCard({ films, year }: { films: Film[]; year: string }) {
  if (!films.length) return null;
  const per: number[] = Array(12).fill(0);
  films.forEach((h) => per[+h.d!.slice(5, 7) - 1]++);
  const max = Math.max(...per);
  const best = per.indexOf(max);
  const rated = films.filter(isRated);
  const counts = new Map<number, number>();
  rated.forEach((h) => counts.set(h.s, (counts.get(h.s) || 0) + 1));
  let mode = 0;
  let mc = 0;
  counts.forEach((c, s) => {
    if (c > mc || (c === mc && s > mode)) {
      mode = s;
      mc = c;
    }
  });
  const avg = rated.length
    ? Math.round((rated.reduce((a, h) => a + h.s, 0) / rated.length) * 10) / 10
    : 0;
  return (
    <section className="v2year" aria-label={`Seu ${year}`}>
      <div className="v2yh">
        <h2>Seu {year}</h2>
        <span>{films.length} {films.length === 1 ? "filme" : "filmes"} até agora</span>
      </div>
      <div
        className="v2bars"
        role="img"
        aria-label={`Filmes por mês em ${year}: ${MONTHS[best].toLowerCase()} foi o mês com mais filmes`}
      >
        {per.map((q, i) => (
          <div key={i}>
            <span
              className={i === best ? "on" : q ? "" : "z"}
              style={{ height: q ? 8 + Math.round((q / max) * 64) : 4 }}
            />
            <small>{MONTHS[i][0]}</small>
          </div>
        ))}
      </div>
      <div className="v2yg">
        <div>
          <small>Nota que você mais dá</small>
          <b className="g">{mode ? "★ " + fmt(mode) : "–"}</b>
        </div>
        <div>
          <small>Nota média</small>
          <b className="s">{avg ? fmt(avg) : "–"}</b>
        </div>
      </div>
    </section>
  );
}

function FriendsBlock({ onError }: { onError: (t: string) => void }) {
  const { friends } = useCloud();
  const [busy, setBusy] = useState("");
  const act = async (fn: (id: string) => Promise<string>, id: string) => {
    setBusy(id);
    const e = await fn(id);
    setBusy("");
    if (e) onError(e);
  };
  const empty = !friends.list.length && !friends.outgoing.length;
  return (
    <>
      {friends.incoming.length > 0 && (
        <>
          <div className="sech">
            <h3>Pedidos de amizade</h3>
          </div>
          <div className="frs">
            {friends.incoming.map((p) => (
              <FriendRow
                key={p.id}
                p={p}
                right={
                  <>
                    <button
                      className="mini"
                      data-ok={p.id}
                      disabled={busy === p.id}
                      onClick={() => void act(cloud.acceptFriend, p.id!)}
                    >
                      Aceitar
                    </button>
                    <button
                      className="mini no"
                      data-no={p.id}
                      disabled={busy === p.id}
                      onClick={() => void act(cloud.removeFriend, p.id!)}
                    >
                      Recusar
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
      <div className="sech">
        <h3>Amigos{friends.list.length ? " · " + friends.list.length : ""}</h3>
        <button id="fadd" onClick={() => nav.open({ k: "addFriend" })}>
          Adicionar
        </button>
      </div>
      <div className="frs">
        {empty && (
          <p
            className="tip"
            style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}
          >
            Ninguém por aqui ainda. Adicione um amigo pelo @ dele.
          </p>
        )}
        {friends.list.map((p) => (
          <FriendRow
            key={p.id}
            p={p}
            right={<i>›</i>}
            onClick={() => nav.push({ k: "friend", id: p.id! })}
          />
        ))}
        {friends.outgoing.map((p) => (
          <FriendRow key={p.id} p={p} right={<i>Pedido enviado</i>} />
        ))}
      </div>
    </>
  );
}

function Board() {
  const tick = useRefresh();
  const rows = useAsync(() => cloud.board(), [tick], true);
  if (!rows || !rows.length) return <div id="board" />;
  return (
    <div id="board">
      <div className="sech">
        <h3>Placar do palpite</h3>
      </div>
      <div className="frs board">
        {rows.map((r, k) => (
          <FriendRow
            key={r.p.id || k}
            p={r.p}
            left={<i className="pos">{k + 1}</i>}
            name={r.me ? "Você" : undefined}
            small={`${r.n} ${r.n === 1 ? "palpite" : "palpites"}`}
            right={<span className="rt">{r.pts} pts</span>}
          />
        ))}
      </div>
    </div>
  );
}

/** Gaveta de ingressos: os filmes vistos no cinema, como uma coleção de canhotos. */
function TicketDrawer() {
  const tickets = useFilms()
    .filter((h) => h.w === "cine")
    .sort((a, b) => (b.d || "").localeCompare(a.d || "") || (b.ts || 0) - (a.ts || 0));
  if (!tickets.length) return null;
  return (
    <section className="drawer">
      <div className="sech">
        <h3>Ingressos · {tickets.length}</h3>
      </div>
      <div className="tkrowh">
        {tickets.map((h) => (
          <Ticket key={fkey(h)} film={h} torn onClick={() => nav.open({ k: "ticket", key: fkey(h) })} />
        ))}
      </div>
    </section>
  );
}
