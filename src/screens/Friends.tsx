// Amigos: pedidos de amizade, a lista de amigos e o botão de adicionar. Abre pelo perfil.
import { useState } from "react";
import { FriendRow } from "../components/FriendRow";
import { cloud, useCloud } from "../lib/cloud";
import { nav } from "../nav";

export function Friends() {
  const { friends } = useCloud();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const act = async (fn: (id: string) => Promise<string>, id: string) => {
    setBusy(id);
    const e = await fn(id);
    setBusy("");
    setErr(e || "");
  };
  const empty = !friends.list.length && !friends.outgoing.length;
  return (
    <div className="screen v2diary">
      <div className="v2dflt">
        <button className="v2chip" id="fadd" onClick={() => nav.open({ k: "addFriend" })}>
          Adicionar
        </button>
      </div>
      <h1 className="v2dh">Amigos</h1>

      {friends.incoming.length > 0 && (
        <section className="v2month">
          <div className="v2mh">
            <h2>Pedidos de amizade</h2>
            <span>{friends.incoming.length}</span>
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
        </section>
      )}

      <section className="v2month">
        <div className="v2mh">
          <h2>Sua turma</h2>
          <span>
            {friends.list.length} {friends.list.length === 1 ? "amigo" : "amigos"}
          </span>
        </div>
        <div className="frs">
          {empty && <p className="empty">Ninguém por aqui ainda. Adicione um amigo pelo @ dele.</p>}
          {friends.list.map((p) => (
            <FriendRow key={p.id} p={p} right={<i>›</i>} onClick={() => nav.push({ k: "friend", id: p.id! })} />
          ))}
          {friends.outgoing.map((p) => (
            <FriendRow key={p.id} p={p} right={<i>Pedido enviado</i>} />
          ))}
        </div>
      </section>
      <p className={`fmsg${err ? " bad" : ""}`} id="fm">
        {err}
      </p>
    </div>
  );
}
