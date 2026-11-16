import type { ReactNode } from 'react';
import { pname } from '../lib/format';
import type { Profile } from '../lib/types';
import { Avatar } from './Avatar';

interface Props { p: Profile; right?: ReactNode; onClick?: () => void; selected?: boolean; left?: ReactNode; name?: string; small?: string }

/** Linha de uma pessoa: foto, nome, @ e algo à direita. Vira botão quando tem onClick. */
export function FriendRow({ p, right, onClick, selected, left, name, small }: Props) {
  const body = (
    <>
      {left}
      <Avatar p={p} />
      <div><b>{name ?? pname(p)}</b>{small ? <small>{small}</small> : p.display_name && p.username ? <small>@{p.username}</small> : null}</div>
      {right}
    </>
  );
  return onClick
    ? <button type="button" className={`fr${selected ? ' sel' : ''}`} onClick={onClick}>{body}</button>
    : <div className="fr">{body}</div>;
}
