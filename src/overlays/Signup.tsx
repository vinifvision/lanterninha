// Criar conta em formato de conversa: uma pergunta por tela, com um rolo de filme mostrando o avanço
// e o facho do projetor ao fundo. A conta nasce no passo da senha; os passos depois dele
// (nome, foto, favoritos, amigos) podem ser pulados, e dá para voltar em qualquer um.
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { FriendRow } from "../components/FriendRow";
import { Overlay } from "../components/Overlay";
import { TopFour } from "../components/TopFour";
import { cleanProfile, cloud, useCloud } from "../lib/cloud";
import { isRated, useFilms } from "../lib/films";
import { sfx } from "../lib/sfx";
import type { Profile, TopItem } from "../lib/types";
import { nav } from "../nav";
import { guide } from "../lib/guide";
import { photoToAvatar, PickTop } from "./EditProfile";

type Step =
  | "user"
  | "email"
  | "pass"
  | "name"
  | "photo"
  | "top4"
  | "friends"
  | "done";
type Avail = "idle" | "check" | "ok" | "taken";
const USER_RE = /^[a-z0-9_.]{3,20}$/;
const calm = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Signup() {
  const account = useCloud();
  const films = useFilms();
  // Os favoritos saem dos filmes já avaliados: sem nenhum, esse passo não aparece
  const hasRated = films.some(isRated);
  const steps: Step[] = [
    "user",
    "email",
    "pass",
    "name",
    "photo",
    ...(hasRated ? (["top4"] as Step[]) : []),
    "friends",
    "done",
  ];

  const [step, setStep] = useState<Step>("user");
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [username, setUsername] = useState("");
  const [avail, setAvail] = useState<Avail>("idle");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [top4, setTop4] = useState<(TopItem | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [slot, setSlot] = useState<number | null>(null);
  const [friendQ, setFriendQ] = useState("");
  const [found, setFound] = useState<Profile | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  /** O que já foi salvo no perfil, para não salvar de novo quando a pessoa volta e avança */
  const saved = useRef({ name: "", avatar: "", top4: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  /** Contagem 3, 2, 1 do começo dos filmes antigos, no último passo (0 = acabou) */
  const [leader, setLeader] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const idx = steps.indexOf(step);
  const created = idx >= steps.indexOf("name");

  const go = (
    s: Step,
    d: "fwd" | "back",
    m: { t: string; bad?: boolean } | null = null,
  ) => {
    setDir(d);
    setMsg(m);
    setStep(s);
  };
  const next = () => go(steps[idx + 1], "fwd");
  // Antes da conta existir dá para voltar até o @; depois, só até o primeiro passo de personalizar
  const canBack = step !== "user" && step !== "name";
  const back = () => {
    if (slot !== null) {
      setSlot(null);
      return true;
    }
    if (!canBack) return false;
    sfx.tick(false);
    go(steps[idx - 1], "back");
    return true;
  };
  // O "voltar" do celular volta um passo em vez de fechar tudo
  useEffect(() => {
    nav.setOverlayBackHandler(back);
    return () => nav.setOverlayBackHandler(null);
  });

  // Confere o @ enquanto a pessoa digita
  useEffect(() => {
    if (!USER_RE.test(username)) {
      setAvail("idle");
      return;
    }
    setAvail("check");
    let alive = true;
    const id = setTimeout(async () => {
      const ok = await cloud.usernameAvailable(username);
      if (alive) setAvail(ok === false ? "taken" : ok ? "ok" : "idle");
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [username]);

  // Último passo: o projetor roda a contagem e então acende tudo
  useEffect(() => {
    if (step !== "done") return;
    if (calm()) {
      setLeader(0);
      sfx.fanfare(0);
      return;
    }
    setLeader(3);
    sfx.projector(1.5);
    const t = [
      setTimeout(() => setLeader(2), 500),
      setTimeout(() => setLeader(1), 1000),
      setTimeout(() => {
        setLeader(0);
        sfx.fanfare(0);
      }, 1500),
    ];
    return () => t.forEach(clearTimeout);
  }, [step]);

  const bad = (t: string) => setMsg({ t, bad: true });
  const save = async (patch: Parameters<typeof cloud.saveProfile>[0]) => {
    setBusy(true);
    setMsg({ t: "Salvando…" });
    const err = await cloud.saveProfile(patch);
    setBusy(false);
    if (err) {
      bad(err);
      return false;
    }
    return true;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (step === "user") {
      if (!USER_RE.test(username))
        return bad("Use de 3 a 20 letras, números, ponto ou _.");
      if (avail === "taken") return bad("Esse @ já é de alguém. Tente outro.");
    } else if (step === "email") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim()))
        return bad("Esse e-mail não parece válido.");
    } else if (step === "pass") {
      if (pw.length < 6)
        return bad("A senha precisa ter pelo menos 6 caracteres.");
      setBusy(true);
      setMsg({ t: "Criando sua conta…" });
      const r = await cloud.signUp(username, email.trim(), pw);
      setBusy(false);
      // Conta nova: a primeira nota guiada aparece assim que a pessoa terminar (ou entrar, se precisar confirmar o e-mail)
      if (r === "CONFIRM" || !r) guide.mark();
      if (r === "CONFIRM")
        return setMsg({
          t: "Conta criada. Confirme pelo e-mail que enviamos e depois entre.",
        });
      if (r.includes("usuário"))
        return go("user", "back", {
          t: "Esse @ acabou de ser escolhido por alguém. Tente outro.",
          bad: true,
        });
      if (r.includes("e-mail")) return go("email", "back", { t: r, bad: true });
      if (r) return bad(r);
      sfx.tick(true);
      return go("name", "fwd");
    } else if (step === "name") {
      const n = name.trim();
      if (
        n !== saved.current.name &&
        !(await save({ display_name: n || null }))
      )
        return;
      saved.current.name = n;
    } else if (step === "photo") {
      if (
        avatar !== saved.current.avatar &&
        !(await save({ avatar: avatar || null }))
      )
        return;
      saved.current.avatar = avatar;
    } else if (step === "top4") {
      const k = JSON.stringify(top4);
      if (k !== saved.current.top4 && !(await save({ top4 }))) return;
      saved.current.top4 = k;
    } else if (step === "done") {
      nav.close();
      nav.tab("rate");
      return;
    }
    next();
  };

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    setMsg({ t: "Preparando a foto…" });
    const a = await photoToAvatar(f);
    if (!a) return bad("Não consegui usar essa imagem.");
    setAvatar(a);
    setMsg(null);
  };
  const findFriend = async () => {
    setFound(null);
    if (!friendQ.trim()) return bad("Digite o @ do seu amigo.");
    setMsg({ t: "Procurando…" });
    const p = await cloud.findUser(friendQ);
    if (!p) return bad("Não achei ninguém com esse @.");
    setFound(p);
    setMsg(null);
  };
  const askFriend = async (p: Profile) => {
    setBusy(true);
    const err = await cloud.requestFriend(p.id!);
    setBusy(false);
    if (err) return bad(err);
    sfx.tick(true);
    setAsked((a) => [...a, p.id!]);
  };

  const shownName = name.trim() || "@" + username;
  const me = account.profile || (cleanProfile({ username }) as Profile);
  const action =
    step === "pass"
      ? "Criar conta"
      : step === "done"
        ? "Começar a avaliar"
        : "Continuar";
  const skippable = created && step !== "done";

  return (
    <>
      <Overlay className={`su${step === "done" && !leader ? " lit" : ""}`}>
        <div
          className="su-beam"
          style={{ transform: `rotate(${idx * 4 - 10}deg)` }}
          aria-hidden="true"
        />
        <div className="ovh su-top">
          {canBack ? (
            <button id="sub" onClick={back}>
              Voltar
            </button>
          ) : step === "user" ? (
            <button id="sux" onClick={() => nav.close()}>
              Fechar
            </button>
          ) : (
            <span />
          )}
          {created && step !== "done" && (
            <button id="sulater" onClick={() => nav.close()}>
              Depois
            </button>
          )}
        </div>
        <div className="su-strip" aria-hidden="true">
          <div
            className="su-reel"
            style={{ transform: `translateX(${-idx * 32}px)` }}
          >
            {steps.map((s, i) => (
              <i key={s} className={i < idx ? "past" : i === idx ? "on" : ""} />
            ))}
          </div>
        </div>

        <form
          key={step}
          className={`su-step su-${dir}`}
          id="suform"
          noValidate
          onSubmit={submit}
        >
          {step === "user" && (
            <>
              <h2>Oi! Como quer ser chamado(a) aqui?</h2>
              <p className="su-sub">
                É o seu @. Seus amigos te acham por ele, e dá para entrar com
                ele.
              </p>
              <div className="su-at">
                <span>@</span>
                <input
                  type="text"
                  id="suf"
                  autoFocus
                  placeholder="seunome"
                  maxLength={20}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => {
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""),
                    );
                    setMsg(null);
                  }}
                />
              </div>
              <p className={`su-av ${avail}`} id="suav">
                <i />
                {avail === "ok"
                  ? `@${username} está livre`
                  : avail === "taken"
                    ? "Esse @ já é de alguém"
                    : avail === "check"
                      ? "Conferindo…"
                      : "3 a 20 letras, números, ponto ou _"}
              </p>
            </>
          )}
          {step === "email" && (
            <>
              <h2>Prazer, @{username}. Qual seu e-mail?</h2>
              <p className="su-sub">
                Ele serve para recuperar a senha. Ninguém mais vê.
              </p>
              <input
                type="email"
                id="suf"
                autoFocus
                placeholder="voce@email.com"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setMsg(null);
                }}
              />
            </>
          )}
          {step === "pass" && (
            <>
              <h2>Agora uma senha</h2>
              <p className="su-sub">
                Pelo menos 6 caracteres.
                {films.length
                  ? " Os filmes deste aparelho vão junto para a conta."
                  : ""}
              </p>
              <div className="pwbox">
                <input
                  type={show ? "text" : "password"}
                  id="suf"
                  autoFocus
                  placeholder="Senha"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setMsg(null);
                  }}
                />
                <button
                  type="button"
                  className="pweye"
                  onClick={() => setShow(!show)}
                >
                  {show ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </>
          )}
          {step === "name" && (
            <>
              {dir === "fwd" && (
                <div className="su-ticket" id="suticket">
                  Conta criada
                </div>
              )}
              <h2>Como seus amigos te chamam?</h2>
              <p className="su-sub">
                Aparece no seu perfil, em cima do @{username}.
              </p>
              <input
                type="text"
                id="suf"
                autoFocus
                maxLength={40}
                placeholder="Seu nome"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setMsg(null);
                }}
              />
            </>
          )}
          {step === "photo" && (
            <>
              <h2>Uma foto sua?</h2>
              <p className="su-sub">Toque no círculo para escolher.</p>
              <button
                type="button"
                className={`su-photo${avatar ? " has" : ""}`}
                id="suphoto"
                onClick={() => file.current?.click()}
              >
                {avatar ? (
                  <Avatar p={{ avatar, display_name: name, username }} />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                )}
              </button>
              {avatar && (
                <button
                  type="button"
                  className="lnk"
                  onClick={() => setAvatar("")}
                >
                  Remover foto
                </button>
              )}
              <input
                ref={file}
                type="file"
                accept="image/*"
                hidden
                id="sufile"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void pickPhoto(f);
                }}
              />
            </>
          )}
          {step === "top4" && (
            <>
              <h2>Seus 4 filmes do coração</h2>
              <p className="su-sub">
                Ficam em destaque no perfil. Escolha entre os que você já
                avaliou.
              </p>
              <TopFour id="sut4" top4={top4} empty="+" onPick={setSlot} />
            </>
          )}
          {step === "friends" && (
            <>
              <h2>Chama a galera</h2>
              <p className="su-sub">
                Procure um amigo pelo @ e mande o pedido. Dá para chamar mais de
                um.
              </p>
              <div className="su-find">
                <input
                  type="text"
                  id="sufq"
                  placeholder="@ do seu amigo"
                  maxLength={21}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={friendQ}
                  onChange={(e) => {
                    setFriendQ(e.target.value);
                    setMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void findFriend();
                    }
                  }}
                />
                <button
                  type="button"
                  className="plain"
                  id="sufind"
                  onClick={() => void findFriend()}
                >
                  Procurar
                </button>
              </div>
              {found && (
                <div className="su-found">
                  <FriendRow
                    p={found}
                    right={
                      asked.includes(found.id!) ||
                      account.friends.outgoing.some(
                        (x) => x.id === found.id,
                      ) ? (
                        <i>Pedido enviado</i>
                      ) : account.friends.list.some(
                          (x) => x.id === found.id,
                        ) ? (
                        <i>Já é seu amigo</i>
                      ) : (
                        <button
                          type="button"
                          className="mini"
                          id="suask"
                          disabled={busy}
                          onClick={() => void askFriend(found)}
                        >
                          Pedir amizade
                        </button>
                      )
                    }
                  />
                </div>
              )}
              {asked.length > 0 && (
                <p className="su-sub" style={{ marginTop: 14 }}>
                  {asked.length === 1
                    ? "1 pedido enviado."
                    : `${asked.length} pedidos enviados.`}
                </p>
              )}
            </>
          )}
          {step === "done" &&
            (leader ? (
              <div className="su-leader" aria-label="Começando">
                <b key={leader}>{leader}</b>
              </div>
            ) : (
              <div className="su-end" id="sudone">
                <div className="su-me">
                  <Avatar
                    p={{ ...me, avatar, display_name: name.trim(), username }}
                  />
                </div>
                <h2>Tudo pronto, {shownName}</h2>
                <p className="su-sub">
                  A sessão vai começar. Que tal avaliar o primeiro filme?
                </p>
              </div>
            ))}

          <p className={`fmsg${msg?.bad ? " bad" : ""}`} id="sum">
            {msg?.t || ""}
          </p>
          {!(step === "done" && leader) && (
            <div className="su-actions">
              <button className="cta" id="sugo" type="submit" disabled={busy}>
                {action}
              </button>
              {skippable && (
                <button
                  type="button"
                  className="lnk"
                  id="suskip"
                  onClick={next}
                >
                  Pular
                </button>
              )}
            </div>
          )}
        </form>
      </Overlay>
      {slot !== null && (
        <PickTop
          slot={slot}
          top4={top4}
          onDone={(f) => {
            setTop4((t) => t.map((x, k) => (k === slot ? f : x)));
            setSlot(null);
          }}
          onClose={() => setSlot(null)}
        />
      )}
    </>
  );
}
