// Aba Perfil: entrar ou criar conta; depois, o perfil com top 4, amigos, placar e sincronização.
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Banner } from "../components/Banner";
import { FriendRow } from "../components/FriendRow";
import { useAsync } from "../components/hooks";
import { Favorites } from "../components/TopFour";
import { cleanProfile, cloud, useCloud } from "../lib/cloud";
import { fkey, isRated, useFilms } from "../lib/films";
import { resetLibraryView } from "./Library";
import { fmt, nFriends } from "../lib/format";
import type { Profile as ProfileData } from "../lib/types";
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

type AuthMode = "in" | "up" | "reset";

function AuthForm() {
  const all = useFilms();
  const account = useCloud();
  // Se a pessoa chegou por um link vencido do e-mail, já abre no "Esqueci minha senha" com o aviso
  const [mode, setMode] = useState<AuthMode>(account.linkError ? "reset" : "in");
  const up = mode === "up";
  const [name, setName] = useState("");
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
  const hint =
    all.length && up
      ? "Os filmes deste aparelho vão junto para a sua conta."
      : "";
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
    if (up && !/^[a-z0-9_.]{3,20}$/.test(name))
      return bad(
        "O nome de usuário precisa de 3 a 20 letras, números, ponto ou _.",
      );
    if (!/^\S+@\S+\.\S+$/.test(mail))
      return bad("Esse e-mail não parece válido.");
    if (mode === "reset") return sendLink(mail);
    if (pw.length < 6)
      return bad("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    setMsg({ t: up ? "Criando…" : "Entrando…" });
    const r = up
      ? await cloud.signUp(name, mail, pw)
      : await cloud.signIn(mail, pw);
    setBusy(false);
    if (r === "CONFIRM") {
      setMode("in");
      setMsg({
        t: "Conta criada. Enviamos um e-mail: confirme por lá e depois entre aqui.",
      });
    } else if (r) bad(r);
  };

  const emailInput = (
    <input
      type="email"
      id="em"
      placeholder="E-mail"
      autoComplete="email"
      autoCapitalize="none"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  );
  const message = (
    <p className={`fmsg${msg?.bad ? " bad" : ""}`} id="fm">
      {msg ? msg.t : hint}
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
        <button data-m="in" className={up ? "" : "on"} onClick={() => go("in")}>
          Entrar
        </button>
        <button data-m="up" className={up ? "on" : ""} onClick={() => go("up")}>
          Criar conta
        </button>
      </div>
      <form id="af" noValidate onSubmit={submit}>
        {up && (
          <input
            type="text"
            id="un"
            placeholder="Nome de usuário"
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={name}
            onChange={(e) =>
              setName(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))
            }
          />
        )}
        {emailInput}
        <input
          type="password"
          id="pw"
          placeholder="Senha"
          autoComplete={up ? "new-password" : "current-password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="cta" id="ago" type="submit" disabled={busy}>
          {up ? "Criar conta" : "Entrar"}
        </button>
      </form>
      {message}
      {!up && (
        <button className="lnk" id="forgot" onClick={() => go("reset")}>
          Esqueci minha senha
        </button>
      )}
    </div>
  );
}

function Account() {
  const account = useCloud();
  const all = useFilms();
  const user = account.user!;
  const pr = account.profile || EMPTY_PROFILE;
  const rated = all.filter(isRated);
  const chestN = all.filter((h) => h.b).length;
  // Todos os assistidos: os avaliados e os marcados como "Já vi" sem nota
  const watched = all.filter((h) => h.st !== "want").length;
  const avg = rated.length
    ? rated.reduce((a, h) => a + h.s, 0) / rated.length
    : 0;
  const title =
    pr.display_name || (pr.username ? "@" + pr.username : "Minha conta");
  const [err, setErr] = useState("");

  const openTop = (i: number) => {
    const f = pr.top4[i];
    if (!f) return nav.open({ k: "editProfile" });
    const h = all.find((x) => fkey(x) === fkey(f));
    if (h) nav.openFilm(h);
  };
  return (
    <div className="screen">
      {pr.banner ? (
        <Banner path={pr.banner} />
      ) : (
        <>
          <h1>Perfil</h1>
          <p className="count">&nbsp;</p>
        </>
      )}
      <div className={`pf${pr.banner ? " onb" : ""}`}>
        <Avatar p={pr} fallback={user.email} />
        <div>
          <b>{title}</b>
          {pr.display_name && pr.username && <em>@{pr.username}</em>}
          {account.social && (
            <small>{nFriends(account.friends.list.length)}</small>
          )}
        </div>
      </div>
      {pr.bio && <p className="bio">{pr.bio}</p>}
      {account.extended && (
        <>
          <button
            className="plain"
            id="ped"
            style={{ margin: "0 0 30px" }}
            onClick={() => nav.open({ k: "editProfile" })}
          >
            Editar perfil
          </button>
          <Favorites id="t4" top4={pr.top4} empty="+" onPick={openTop} />
        </>
      )}
      <div className="stat">
        <button type="button" id="pfn" onClick={() => { resetLibraryView(); nav.tab("lib"); }}>
          <b>{watched}</b>
          <span>{watched === 1 ? "filme visto" : "filmes vistos"}</span>
        </button>
        <div>
          <b>{rated.length ? fmt(Math.round(avg * 10) / 10) : "–"}</b>
          <span>nota média</span>
        </div>
      </div>
      <button className="chrow" id="chprof" onClick={() => nav.push({ k: "chest" })}>
        <ChestIcon />
        <span>
          <b>Baú da infância</b>
          <small>{chestN ? `${chestN} ${chestN === 1 ? "filme lembrado" : "filmes lembrados"}` : "Relembre os filmes da sua infância"}</small>
        </span>
        <i>›</i>
      </button>
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
  const rows = useAsync(() => cloud.board(), []);
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
