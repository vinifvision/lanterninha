// Conta, sincronização e tudo que é social (amigos, indicações, palpite), em cima do Supabase.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { API_BASE, isNativeApp, SITE_URL, SUPABASE_KEY, SUPABASE_URL } from './config';
import { cleanFilm, fhash, films, fkey, isRated } from './films';
import { pname, POSTER_PATH, UUID } from './format';
import type { CineTag, Film, FilmInfo, FriendRating, Friends, Profile, RatedFilm, Rec, TagStatus, TopItem } from './types';

export type SyncState = 'off' | 'busy' | 'ok' | 'err';
export interface CloudUser { id: string; email: string }
export interface CloudState {
  /** O cliente do Supabase carregou */
  ready: boolean;
  /** Já se sabe se há alguém logado (a sessão salva foi conferida) */
  checked: boolean;
  user: CloudUser | null;
  profile: Profile | null;
  /** O banco já tem os campos de perfil (nome, bio, foto, top 4) */
  extended: boolean;
  /** O banco já tem a coluna do banner (script supabase-banner.sql) */
  banners: boolean;
  /** O banco já tem as tabelas de amizade */
  social: boolean;
  friends: Friends;
  recs: Rec[];
  /** Avisos de ingresso esperando resposta ("Fulano disse que vocês viram X juntos") */
  tags: CineTag[];
  /** O que cada amigo marcado no meu ingresso respondeu: filme → amigo → resposta */
  sent: Record<string, Record<string, TagStatus>>;
  /** Amigos que me marcaram e eu confirmei: filme → ids */
  withMe: Record<string, string[]>;
  sync: SyncState;
  /** A pessoa abriu o link de "Esqueci minha senha" e precisa criar uma senha nova */
  recovery: boolean;
  /** O link do e-mail chegou vencido ou já usado */
  linkError: string;
}

const emptyFriends = (): Friends => ({ list: [], incoming: [], outgoing: [] });

export function cleanProfile(p: unknown): Profile | null {
  const r = p as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;
  const o: Profile = {
    username: typeof r.username === 'string' && /^[a-z0-9_.]{3,20}$/.test(r.username) ? r.username : '',
    display_name: typeof r.display_name === 'string' ? r.display_name.trim().slice(0, 40) : '',
    bio: typeof r.bio === 'string' ? r.bio.trim().slice(0, 160) : '',
    avatar: typeof r.avatar === 'string' && r.avatar.length <= 80000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.avatar) ? r.avatar : '',
    banner: typeof r.banner === 'string' && POSTER_PATH.test(r.banner) ? r.banner : '',
    top4: (Array.isArray(r.top4) ? r.top4 : []).slice(0, 4).map((x): TopItem | null => {
      const t = x as Record<string, unknown> | null;
      if (!t || typeof t.t !== 'string' || !t.t.trim()) return null;
      return {
        id: Number.isInteger(t.id) ? (t.id as number) : null,
        t: t.t.trim().slice(0, 120),
        img: typeof t.img === 'string' && POSTER_PATH.test(t.img) ? t.img : '',
        y: typeof t.y === 'string' && /^\d{4}$/.test(t.y) ? t.y : '',
      };
    }),
  };
  if (typeof r.id === 'string' && UUID.test(r.id)) o.id = r.id;
  while (o.top4.length < 4) o.top4.push(null);
  return o;
}

// ---------- estado interno
let sb: SupabaseClient | null = null;
let user: CloudUser | null = null;
/** Dados guardados na própria conta (user_metadata), ex.: qual tela de Novidades já foi vista */
let accountMeta: Record<string, unknown> = {};
let profile: Profile | null = null;
let extended = false, social = false, banners = false;
let friends: Friends = emptyFriends();
let recs: Rec[] = [];
let tags: CineTag[] = [], sent: CloudState['sent'] = {}, withMe: CloudState['withMe'] = {}, tagsOk = false;
let sync: SyncState = 'off';
let recovery = false, linkError = '';
let checked = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false, again = false, lastPull = 0, paused = false;

const lsGet = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ } };
/** Impressão digital de cada filme na última sincronização: é assim que se descobre o que mudou. */
let synced: Record<string, string> = lsGet('lantSynced', {});
let owner: string | null = lsGet<string | null>('lantOwner', null);
const keep = () => { lsSet('lantSynced', synced); lsSet('lantOwner', owner); };

let snapshot: CloudState = { ready: false, checked, user, profile, extended, banners, social, friends, recs, tags, sent, withMe, sync, recovery, linkError };
const listeners = new Set<() => void>();
function emit() {
  snapshot = { ready: !!sb, checked, user, profile, extended, banners, social, friends, recs, tags, sent, withMe, sync, recovery, linkError };
  listeners.forEach((l) => l());
}
const setSync = (s: SyncState) => { sync = s; emit(); };

// ---------- sincronização
async function send(up: Film[], del: string[]) {
  if (!sb || !user) return;
  if (up.length) {
    const rows = up.map((h) => ({ user_id: user!.id, key: fkey(h), data: h, updated_at: new Date().toISOString() }));
    const { error } = await sb.from('films').upsert(rows, { onConflict: 'user_id,key' });
    if (error) throw error;
  }
  if (del.length) {
    const { error } = await sb.from('films').delete().eq('user_id', user.id).in('key', del);
    if (error) throw error;
  }
}

/** Junta o que está na nuvem com o que está no aparelho. */
async function pull(): Promise<void> {
  if (!sb || !user || busy || paused) return;
  busy = true; setSync('busy');
  try {
    let hist = films.all;
    if (owner && owner !== user.id) { hist = []; synced = {}; }
    owner = user.id;
    const remote: Record<string, unknown> = {};
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('films').select('key,data').eq('user_id', user.id).range(from, from + 999);
      if (error) throw error;
      (data || []).forEach((r) => { remote[r.key as string] = r.data; });
      if (!data || data.length < 1000) break;
    }
    const out: Film[] = [], up: Film[] = [], del: string[] = [], seen = new Set<string>();
    hist.forEach((h) => {
      const k = fkey(h), hs = fhash(h), same = synced[k] === hs;
      seen.add(k);
      if (k in remote) {
        if (same) { const c = cleanFilm(remote[k]); out.push(c && fhash(c) !== hs ? c : h); } // não mudou aqui: vale o da nuvem
        else { out.push(h); up.push(h); }                                                      // mudou aqui: sobe
      } else if (!same) { out.push(h); up.push(h); }                                          // novo aqui: sobe
      // senão: foi apagado em outro aparelho
    });
    Object.keys(remote).forEach((k) => {
      if (seen.has(k)) return;
      if (k in synced) del.push(k);                                                            // apagado aqui: apaga lá
      else { const c = cleanFilm(remote[k]); if (c) out.push(c); }                             // novo de outro aparelho
    });
    await send(up, del);
    out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    synced = {};
    out.forEach((h) => { synced[fkey(h)] = fhash(h); });
    keep(); lastPull = Date.now(); busy = false;
    films.replaceAll(out);
    setSync('ok');
  } catch {
    busy = false; setSync('err');
  }
  if (again) { again = false; void push(); }
}

/** Manda só o que mudou desde a última sincronização. */
async function push(): Promise<boolean> {
  if (!sb || !user) return true;
  if (busy) { again = true; return false; }
  busy = true; setSync('busy');
  try {
    const now: Record<string, string> = {}, up: Film[] = [];
    films.all.forEach((h) => { const k = fkey(h), hs = fhash(h); now[k] = hs; if (synced[k] !== hs) up.push(h); });
    const del = Object.keys(synced).filter((k) => !(k in now));
    await send(up, del);
    synced = now; keep(); busy = false; setSync('ok');
    if (again) { again = false; return push(); }
    return true;
  } catch {
    busy = false; setSync('err');
    return false;
  }
}

// ---------- conta, perfil e amigos
async function loadFriends(): Promise<void> {
  if (!sb || !user) return;
  try {
    const { data, error } = await sb.from('friendships').select('requester,addressee,status');
    if (error) throw error;
    social = true;
    const me = user.id, rows = data || [];
    const other = (r: { requester: string; addressee: string }) => (r.requester === me ? r.addressee : r.requester);
    const ids = [...new Set(rows.map(other))].filter((i) => UUID.test(i));
    const map = new Map<string, Profile>();
    if (ids.length) {
      const pr = await sb.from('profiles').select('id,username,display_name,bio,avatar,top4' + (banners ? ',banner' : '')).in('id', ids);
      (pr.data || []).forEach((x) => { const c = cleanProfile(x); if (c?.id) map.set(c.id, c); });
    }
    const f = emptyFriends();
    rows.forEach((r) => {
      const pf = map.get(other(r)); if (!pf) return;
      (r.status === 'accepted' ? f.list : r.requester === me ? f.outgoing : f.incoming).push(pf);
    });
    f.list.sort((a, b) => pname(a).localeCompare(pname(b)));
    friends = f;
    try {
      const rr = await sb.from('recs').select('id,from_id,film,note').eq('to_id', me);
      recs = (rr.data || [])
        .map((r) => ({
          id: r.id as number,
          p: f.list.find((x) => x.id === r.from_id),
          film: cleanFilm({ ...(r.film as object), st: 'want' }),
          note: typeof r.note === 'string' ? r.note.trim().slice(0, 200) : '',
        }))
        .filter((r): r is Rec => !!r.p && !!r.film && Number.isInteger(r.id))
        .filter((r) => !films.all.some((h) => fkey(h) === fkey(r.film) && !h.st));
    } catch {
      recs = [];
    }
    await loadTags();
  } catch {
    social = false;
  }
  emit();
  void syncTags();
}

// ---------- ingresso com amigos ("Amigo confirma"). Precisa do script supabase-ingressos.sql.
async function loadTags(): Promise<void> {
  if (!sb || !user) return;
  try {
    const { data, error } = await sb.from('cine_tags').select('id,from_id,to_id,film_key,film,cine,seen,status');
    if (error) throw error;
    tagsOk = true;
    const me = user.id, str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const s: CloudState['sent'] = {}, w: CloudState['withMe'] = {}, inc: CineTag[] = [];
    (data || []).forEach((r) => {
      const key = str(r.film_key, 40), st = r.status as TagStatus;
      if (!key || !['pending', 'accepted', 'declined'].includes(st)) return;
      if (r.from_id === me) { (s[key] ||= {})[r.to_id as string] = st; return; }
      if (r.to_id !== me) return;
      if (st === 'accepted') { (w[key] ||= []).push(r.from_id as string); return; }
      if (st !== 'pending') return;
      const p = friends.list.find((x) => x.id === r.from_id);
      const f = cleanFilm({ ...(r.film as object), st: 'seen' });
      const seen = str(r.seen, 10);
      if (!p || !f || !Number.isInteger(r.id)) return;
      const info: FilmInfo = { t: f.t };
      if (f.id) { info.id = f.id; if (f.y) info.y = f.y; if (f.o) info.o = f.o; if (f.img) info.img = f.img; }
      inc.push({ id: r.id as number, p, film: info, cine: str(r.cine, 60), seen: /^\d{4}-\d{2}-\d{2}$/.test(seen) ? seen : '' });
    });
    tags = inc; sent = s; withMe = w;
  } catch {
    tagsOk = false; tags = []; sent = {}; withMe = {};
  }
}

let tagBusy = false, tagAgain = false;
/** Deixa os avisos enviados iguais aos amigos marcados nos ingressos: manda os novos e apaga os desmarcados. */
async function syncTags(): Promise<void> {
  if (!sb || !user || !tagsOk) return;
  if (tagBusy) { tagAgain = true; return; }
  tagBusy = true;
  try {
    let changed = false;
    const friendIds = new Set(friends.list.map((p) => p.id));
    const local = new Map(films.all.map((h) => [fkey(h), h] as const));
    for (const h of films.all) {
      if (h.w !== 'cine' || !h.tk?.with?.length) continue;
      const key = fkey(h);
      for (const id of h.tk.with) {
        // Não manda de volta para quem me marcou nesse filme
        if (!friendIds.has(id) || sent[key]?.[id] || withMe[key]?.includes(id)) continue;
        const info: FilmInfo = { t: h.t };
        if (h.id) { info.id = h.id; if (h.y) info.y = h.y; if (h.o) info.o = h.o; if (h.img) info.img = h.img; }
        const { error } = await sb.from('cine_tags').insert({ to_id: id, film_key: key, film: info, cine: h.tk.cine || null, seen: h.d || null });
        if (!error || error.code === '23505') changed = true;
      }
    }
    // Só apaga quando o filme está no aparelho (num aparelho novo, os filmes ainda podem estar chegando)
    for (const [key, who] of Object.entries(sent)) {
      const h = local.get(key);
      if (!h) continue;
      for (const id of Object.keys(who)) {
        if (h.w === 'cine' && h.tk?.with?.includes(id)) continue;
        await sb.from('cine_tags').delete().eq('from_id', user.id).eq('to_id', id).eq('film_key', key);
        changed = true;
      }
    }
    if (changed) { await loadTags(); emit(); }
  } catch { /* tenta de novo na próxima mudança */ }
  tagBusy = false;
  if (tagAgain) { tagAgain = false; void syncTags(); }
}
let tagTimer: ReturnType<typeof setTimeout> | undefined;

async function onAuth(sessionUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
  const u: CloudUser | null = sessionUser ? { id: sessionUser.id, email: sessionUser.email || '' } : null;
  const first = !checked;
  checked = true;
  if ((u?.id || null) === (user?.id || null)) { if (first) emit(); return; }
  accountMeta = sessionUser?.user_metadata || {};
  user = u; profile = null; friends = emptyFriends(); recs = []; social = false;
  tags = []; sent = {}; withMe = {}; tagsOk = false;
  if (!u || !sb) { sync = 'off'; emit(); return; }
  emit();
  try {
    // Tenta do banco mais novo para o mais antigo, para o app funcionar mesmo sem os scripts mais recentes
    let r = await sb.from('profiles').select('username,display_name,bio,avatar,top4,banner').eq('id', u.id).maybeSingle();
    banners = !r.error;
    if (r.error) r = await sb.from('profiles').select('username,display_name,bio,avatar,top4').eq('id', u.id).maybeSingle();
    if (r.error) { r = await sb.from('profiles').select('username').eq('id', u.id).maybeSingle(); extended = false; } else extended = true;
    profile = cleanProfile(r.data);
  } catch { /* segue sem perfil */ }
  emit();
  void pull();
  void loadFriends();
}

function niceError(e: { message?: string } | null): string {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('different from the old')) return 'A senha nova precisa ser diferente da antiga.';
  if (m.includes('session missing') || m.includes('session not found')) return 'O link venceu. Peça um novo em "Esqueci minha senha".';
  if (m.includes('not authorized')) return 'Não consegui enviar o e-mail agora. Tente mais tarde.';
  if (m.includes('invalid login')) return 'E-mail ou senha errados.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Esse e-mail já tem conta. Tente entrar.';
  if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('not confirmed')) return 'Confirme seu e-mail pelo link que enviamos e tente de novo.';
  if (m.includes('rate') || m.includes('seconds')) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (m.includes('valid email') || m.includes('invalid format') || m.includes('is invalid')) return 'Esse e-mail não parece válido.';
  return 'Não deu certo agora. Tente de novo.';
}

/** Quando o link do e-mail está vencido, o Supabase devolve o erro no endereço
 *  (ex.: #error_code=otp_expired). Lê o erro e limpa o endereço. */
function readLinkError(): string {
  try {
    const p = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
    if (!p.get('error') && !p.get('error_code')) return '';
    history.replaceState(null, '', location.pathname);
    return 'Esse link venceu ou já foi usado. Peça um novo aqui embaixo.';
  } catch { return ''; }
}

function init() {
  linkError = readLinkError();
  try {
    // Nos testes automáticos, um cliente falso pode ser injetado aqui.
    const fake = (window as unknown as { __LANTERNINHA_TEST_CLIENT__?: SupabaseClient }).__LANTERNINHA_TEST_CLIENT__;
    sb = fake || createClient(SUPABASE_URL, SUPABASE_KEY);
    // O setTimeout evita chamar o Supabase de dentro do próprio aviso de login (isso trava o cliente).
    sb.auth.onAuthStateChange((event, session) => {
      // Veio do link de "Esqueci minha senha": a pessoa já entra e o app pede a senha nova
      if (event === 'PASSWORD_RECOVERY') { recovery = true; emit(); }
      setTimeout(() => void onAuth(session?.user ?? null), 0);
    });
  } catch {
    sb = null;
  }
  emit();
}

films.setLocalChangeHandler(() => {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => void push(), 1200);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && user && Date.now() - lastPull > 60000) void pull();
});

export const cloud = {
  init,
  get state(): CloudState { return snapshot; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Enquanto a pessoa está avaliando, a sincronização espera para não trocar os dados embaixo dela. */
  setPaused(p: boolean) { paused = p; },
  syncNow: () => pull(),
  loadFriends,

  /** Entra com o e-mail ou com o @. O Supabase só entra com e-mail, então o @ passa pela
   *  função /api/login, que acha o e-mail da conta sem mostrá-lo e devolve a sessão. */
  async signIn(login: string, password: string): Promise<string> {
    if (!sb) return 'Sem conexão com a conta agora.';
    const id = login.trim().replace(/^@/, '');
    if (id.includes('@')) {
      const { error } = await sb.auth.signInWithPassword({ email: id, password });
      return error ? niceError(error) : '';
    }
    let r: Response;
    try {
      r = await fetch(API_BASE + 'api/login', {
        method: 'POST',
        // text/plain evita a pergunta extra (CORS) que o navegador faria antes de mandar JSON
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ username: id.toLowerCase(), password }),
      });
    } catch {
      return 'Sem conexão. Confira a internet e tente de novo.';
    }
    const d = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
    if (r.ok && d.access_token && d.refresh_token) {
      const { error } = await sb.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
      return error ? niceError(error) : '';
    }
    if (d.error === 'invalid_login') return '@ ou senha errados.';
    if (d.error === 'not_confirmed') return niceError({ message: 'not confirmed' });
    if (r.status === 429) return niceError({ message: 'rate' });
    return 'Não deu certo agora. Tente de novo.';
  },
  /** Devolve '' se entrou, 'CONFIRM' se falta confirmar o e-mail, ou a mensagem de erro. */
  async signUp(username: string, email: string, password: string, extra: Record<string, unknown> = {}): Promise<string> {
    if (!sb) return 'Sem conexão com a conta agora.';
    try {
      const { data, error } = await sb.rpc('username_available', { name: username });
      if (!error && data === false) return 'Esse nome de usuário já existe.';
    } catch { /* segue: o banco barra nomes repetidos de qualquer jeito */ }
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { ...extra, username } } });
    if (error) return niceError(error);
    return data.session ? '' : 'CONFIRM';
  },
  /** Manda o e-mail com o link para criar uma senha nova. O link sempre abre o site
   *  (no app de celular, abre no navegador). */
  async sendReset(email: string): Promise<string> {
    if (!sb) return 'Sem conexão com a conta agora.';
    const redirectTo = isNativeApp ? SITE_URL : location.origin + '/';
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    return error ? niceError(error) : '';
  },
  async setNewPassword(password: string): Promise<string> {
    if (!sb) return 'Sem conexão com a conta agora.';
    const { error } = await sb.auth.updateUser({ password });
    return error ? niceError(error) : '';
  },
  /** Dados guardados na conta (user_metadata) de quem está logado. */
  accountData(): Record<string, unknown> { return accountMeta; },
  /** Guarda dados na conta. O Supabase junta com o que já existe (não apaga o resto). */
  saveAccountData(data: Record<string, unknown>) {
    accountMeta = { ...accountMeta, ...data };
    if (!sb || !user) return;
    void sb.auth.updateUser({ data }).catch(() => undefined);
  },
  /** O app já abriu a tela de senha nova. */
  recoveryShown() { if (recovery) { recovery = false; emit(); } },
  /** O aviso de link vencido já apareceu. */
  linkErrorShown() { if (linkError) { linkError = ''; emit(); } },
  async signOut(): Promise<string> {
    if (!sb) return '';
    clearTimeout(timer);
    if (!(await push())) return 'Não consegui salvar as últimas mudanças. Confira a internet e tente de novo.';
    await sb.auth.signOut();
    synced = {}; owner = null; keep();
    films.replaceAll([]);
    return '';
  },

  async saveProfile(patch: Partial<Pick<Profile, 'top4'>> & { display_name?: string | null; bio?: string | null; avatar?: string | null; banner?: string | null }): Promise<string> {
    if (!sb || !user) return 'Entre na conta primeiro.';
    const { error } = await sb.from('profiles').update(patch).eq('id', user.id);
    if (error) return 'Não consegui salvar agora. Tente de novo.';
    profile = cleanProfile({ ...profile, ...patch });
    emit();
    return '';
  },

  /** O @ está livre? null quando não deu para conferir agora. */
  async usernameAvailable(name: string): Promise<boolean | null> {
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc('username_available', { name });
      return error || typeof data !== 'boolean' ? null : data;
    } catch { return null; }
  },
  async friendCount(id: string): Promise<number | null> {
    if (!sb || !UUID.test(id)) return null;
    try { const { data, error } = await sb.rpc('friend_count', { who: id }); return error || typeof data !== 'number' ? null : data; } catch { return null; }
  },
  async findUser(raw: string): Promise<Profile | null> {
    const name = raw.trim().toLowerCase().replace(/^@/, '');
    if (!sb || !/^[a-z0-9_.]{3,20}$/.test(name)) return null;
    try {
      const { data, error } = await sb.rpc('find_user', { name });
      if (error) return null;
      const c = cleanProfile(Array.isArray(data) ? data[0] : data);
      return c?.id ? c : null;
    } catch { return null; }
  },
  async requestFriend(id: string): Promise<string> {
    if (!sb || !UUID.test(id)) return 'Não deu certo.';
    if (friends.incoming.some((p) => p.id === id)) return cloud.acceptFriend(id);
    const { error } = await sb.from('friendships').insert({ addressee: id });
    if (error) return 'Não consegui enviar o pedido.';
    await loadFriends();
    return '';
  },
  async acceptFriend(id: string): Promise<string> {
    if (!sb || !UUID.test(id)) return 'Não deu certo.';
    const { error } = await sb.rpc('accept_friend', { other: id });
    if (error) return 'Não consegui aceitar agora.';
    await loadFriends();
    return '';
  },
  async removeFriend(id: string): Promise<string> {
    if (!sb || !user || !UUID.test(id)) return 'Não deu certo.';
    const { error } = await sb.from('friendships').delete()
      .or(`and(requester.eq.${user.id},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${user.id})`);
    if (error) return 'Não consegui remover agora.';
    await loadFriends();
    return '';
  },

  /** Os filmes avaliados de um amigo, do mais recente para o mais antigo. */
  async friendFilms(id: string): Promise<RatedFilm[] | null> {
    if (!sb || !UUID.test(id)) return null;
    try {
      const out: RatedFilm[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('films').select('key,data').eq('user_id', id).range(from, from + 999);
        if (error) return null;
        (data || []).forEach((r) => { const c = cleanFilm(r.data); if (isRated(c)) out.push(c); });
        if (!data || data.length < 1000) break;
      }
      return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    } catch { return null; }
  },
  /** O que os amigos guardaram em "Quero ver" (para o aviso de match na fila). */
  async friendsWant(): Promise<{ p: Profile; f: Film }[]> {
    if (!sb || !user || !friends.list.length) return [];
    try {
      const ids = friends.list.map((f) => f.id!).filter((id) => UUID.test(id));
      const { data, error } = await sb.from('films').select('user_id,data').in('user_id', ids).eq('data->>st', 'want').limit(500);
      if (error) return [];
      return (data || [])
        .map((r) => ({ p: friends.list.find((f) => f.id === r.user_id), f: cleanFilm(r.data) }))
        .filter((x): x is { p: Profile; f: Film } => !!x.p && x.f?.st === 'want');
    } catch { return []; }
  },
  /** As avaliações mais recentes dos amigos, da mais nova para a mais antiga. */
  async friendsActivity(limit = 30): Promise<FriendRating[]> {
    if (!sb || !user || !friends.list.length) return [];
    try {
      const ids = friends.list.map((f) => f.id!).filter((id) => UUID.test(id));
      const { data, error } = await sb.from('films').select('user_id,data').in('user_id', ids)
        .order('updated_at', { ascending: false }).limit(limit * 3);
      if (error) return [];
      return (data || [])
        .map((r) => ({ p: friends.list.find((f) => f.id === r.user_id), f: cleanFilm(r.data) }))
        .filter((x): x is FriendRating => !!x.p && isRated(x.f))
        .sort((a, b) => (b.f.ts || 0) - (a.f.ts || 0))
        .slice(0, limit);
    } catch { return []; }
  },
  /** Notas de todos no Lanterninha para um filme: média, total e quantas pessoas deram cada nota (½ a 5).
   *  Nunca diz quem deu cada nota. Sem o script novo no banco, cai para só a média. */
  async filmStats(key: string): Promise<{ avg: number; n: number; dist: number[] | null } | null> {
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc('film_stats', { film_key: key });
      if (error) { const a = await this.filmAverage(key); return a && { ...a, dist: null }; }
      const dist = Array<number>(10).fill(0);
      for (const row of (data || []) as { s?: unknown; n?: unknown }[]) {
        const s = Number(row.s), n = Number(row.n) || 0;
        if (s >= 0.5 && s <= 5 && Number.isInteger(s * 2) && n > 0) dist[s * 2 - 1] += n;
      }
      const n = dist.reduce((a, b) => a + b, 0);
      if (!n) return null;
      const avg = dist.reduce((a, c, i) => a + c * (i + 1) / 2, 0) / n;
      return { avg: Math.round(avg * 10) / 10, n, dist };
    } catch { return null; }
  },
  /** Média das notas de todos no Lanterninha para um filme (sem mostrar a nota de ninguém). */
  async filmAverage(key: string): Promise<{ avg: number; n: number } | null> {
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc('film_average', { film_key: key });
      if (error) return null;
      const row = (Array.isArray(data) ? data[0] : data) as { avg?: unknown; n?: unknown } | null;
      const n = Number(row?.n) || 0, avg = Number(row?.avg);
      return n > 0 && avg >= 0.5 && avg <= 5 ? { avg, n } : null;
    } catch { return null; }
  },
  /** Quais amigos avaliaram cada um destes filmes (para as páginas de diretor, ator e produtora). */
  async friendsSeen(keys: string[]): Promise<Map<string, Profile[]>> {
    const out = new Map<string, Profile[]>();
    if (!sb || !user || !friends.list.length || !keys.length) return out;
    try {
      const ids = friends.list.map((f) => f.id!).filter((id) => UUID.test(id));
      // Em partes, para o endereço da consulta não ficar grande demais
      for (let i = 0; i < keys.length; i += 100) {
        const { data, error } = await sb.from('films').select('user_id,key,data').in('user_id', ids).in('key', keys.slice(i, i + 100));
        if (error) return out;
        for (const r of data || []) {
          const p = friends.list.find((f) => f.id === r.user_id);
          if (!p || !isRated(cleanFilm(r.data))) continue;
          const k = r.key as string;
          out.set(k, [...(out.get(k) || []), p]);
        }
      }
    } catch { /* sem dados */ }
    return out;
  },
  /** O que cada amigo achou de um filme. */
  async filmRatings(key: string): Promise<FriendRating[]> {
    if (!sb || !user || !friends.list.length) return [];
    try {
      const { data, error } = await sb.from('films').select('user_id,data').eq('key', key).neq('user_id', user.id);
      if (error) return [];
      return (data || [])
        .map((r) => ({ p: friends.list.find((f) => f.id === r.user_id), f: cleanFilm(r.data) }))
        .filter((x): x is FriendRating => !!x.p && isRated(x.f));
    } catch { return []; }
  },

  async sendRec(ids: string[], film: FilmInfo, note: string): Promise<string> {
    const to = ids.filter((i) => UUID.test(i));
    if (!sb || !to.length) return 'Escolhe pelo menos um amigo.';
    const f: FilmInfo = { t: film.t };
    if (film.id) { f.id = film.id; if (film.y) f.y = film.y; if (film.o) f.o = film.o; if (film.img) f.img = film.img; }
    let ok = 0;
    for (const id of to) {
      const { error } = await sb.from('recs').insert({ to_id: id, film_key: fkey(film), film: f, note: note || null });
      if (!error || error.code === '23505' || /duplicate|unique/i.test(error.message || '')) ok++;
    }
    return ok ? '' : 'Não consegui enviar agora.';
  },
  /** Chamado quando a pessoa marca ou desmarca amigos no ingresso. Espera um pouco para juntar os toques. */
  syncTags() { clearTimeout(tagTimer); tagTimer = setTimeout(() => void syncTags(), 900); },
  /** Responde ao aviso de ingresso. Devolve o filme quando a pessoa confirma. */
  async answerTag(tag: CineTag, ok: boolean): Promise<Film | null> {
    tags = tags.filter((t) => t.id !== tag.id);
    let film: Film | null = null;
    if (ok) {
      film = films.fromTag(tag.film, tag.cine, tag.seen);
      const key = fkey(film);
      if (tag.p.id) withMe = { ...withMe, [key]: [...(withMe[key] || []), tag.p.id] };
    }
    emit();
    try { await sb?.rpc('answer_cine_tag', { tag_id: tag.id, ok }); } catch { /* o aviso volta na próxima carga */ }
    return film;
  },
  async dropRec(id: number): Promise<void> {
    recs = recs.filter((r) => r.id !== id); emit();
    try { await sb?.from('recs').delete().eq('id', id); } catch { /* some na próxima carga */ }
  },

  async guessedKeys(target: string): Promise<Set<string> | null> {
    if (!sb || !user || !UUID.test(target)) return null;
    try {
      const { data, error } = await sb.from('guesses').select('film_key').eq('guesser', user.id).eq('target', target);
      return error ? null : new Set((data || []).map((r) => r.film_key as string));
    } catch { return null; }
  },
  async sendGuess(target: string, key: string, guess: number): Promise<boolean> {
    if (!sb || !UUID.test(target)) return false;
    try { const { error } = await sb.from('guesses').insert({ target, film_key: key, guess }); return !error; } catch { return false; }
  },

  /** Curtidas das reviews de um filme: autor da review → ids de quem curtiu.
   *  null = o banco ainda não tem a tabela (script supabase-curtidas.sql) ou deu erro: o botão some. */
  async reviewLikes(key: string): Promise<Record<string, string[]> | null> {
    if (!sb || !user) return null;
    try {
      const { data, error } = await sb.from('review_likes').select('author_id,user_id').eq('film_key', key);
      if (error) return null;
      const out: Record<string, string[]> = {};
      (data || []).forEach((r) => { (out[r.author_id as string] ||= []).push(r.user_id as string); });
      return out;
    } catch { return null; }
  },
  /** Curte (on) ou descurte a review de um amigo. Devolve se deu certo. */
  async likeReview(author: string, key: string, on: boolean): Promise<boolean> {
    if (!sb || !user || !UUID.test(author)) return false;
    try {
      const { error } = on
        ? await sb.from('review_likes').insert({ author_id: author, film_key: key })
        : await sb.from('review_likes').delete().eq('author_id', author).eq('film_key', key).eq('user_id', user.id);
      return !error || (on && error.code === '23505');
    } catch { return false; }
  },
};

/** Hook: estado da conta (usuário, perfil, amigos, indicações, sincronização). */
export function useCloud(): CloudState {
  return useSyncExternalStore(cloud.subscribe, () => snapshot);
}

