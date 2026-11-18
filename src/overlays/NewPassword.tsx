// Senha nova: abre quando a pessoa toca no link de "Esqueci minha senha" do e-mail.
// O link já deixa a pessoa dentro da conta; aqui ela só escolhe a senha nova.
import { useEffect, useRef, useState } from "react";
import { Overlay, OverlayHeader } from "../components/Overlay";
import { cloud, useCloud } from "../lib/cloud";
import { isNativeApp } from "../lib/config";
import { sfx } from "../lib/sfx";
import { nav } from "../nav";

export function NewPassword() {
  const account = useCloud();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean }>({ t: "" });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 300);
    return () => clearTimeout(id);
  }, []);
  const who = account.profile?.username
    ? "@" + account.profile.username
    : account.user?.email || "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6)
      return setMsg({ t: "A senha precisa ter pelo menos 6 caracteres.", bad: true });
    setBusy(true);
    setMsg({ t: "Salvando…" });
    const err = await cloud.setNewPassword(pw);
    setBusy(false);
    if (err) return setMsg({ t: err, bad: true });
    sfx.fanfare(0);
    setDone(true);
  };

  if (done)
    return (
      <Overlay>
        <OverlayHeader left={<span style={{ width: 52 }} />} title="Senha nova" />
        <div className="rsent" id="npdone">
          <div className="rsent-ic ok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <b>Senha nova salva</b>
          <p>
            Você já está na sua conta.
            {!isNativeApp && " Se usa o app no celular, entre lá com a senha nova."}
          </p>
          <button className="cta" id="npok" onClick={() => nav.close()}>
            Continuar
          </button>
        </div>
      </Overlay>
    );

  return (
    <Overlay>
      <OverlayHeader
        left={<button id="npx" onClick={() => nav.close()}>Depois</button>}
        title="Senha nova"
      />
      <p className="rlead">
        Crie uma senha nova{who ? <> para <b>{who}</b></> : null}. Ela precisa ter pelo menos 6 caracteres.
      </p>
      <form id="npf" noValidate onSubmit={save}>
        <div className="pwbox">
          <input
            ref={input}
            type={show ? "text" : "password"}
            id="npw"
            placeholder="Senha nova"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button type="button" className="pweye" onClick={() => setShow(!show)}>
            {show ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <button className="cta" id="nps" type="submit" disabled={busy}>
          Salvar senha
        </button>
      </form>
      <p className={`fmsg${msg.bad ? " bad" : ""}`} id="npm">
        {msg.t}
      </p>
    </Overlay>
  );
}
