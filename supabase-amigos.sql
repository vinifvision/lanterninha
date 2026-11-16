-- Lanterninha: amizades. Amigos passam a ver o perfil e os filmes um do outro.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".

-- 1) Tabela de amizades (pedido pendente ou aceito)
create table if not exists public.friendships (
  requester uuid not null default auth.uid() references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- So pode existir um registro por dupla, em qualquer direcao
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists "Cada um ve as proprias amizades" on public.friendships;
create policy "Cada um ve as proprias amizades"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

drop policy if exists "Cada um envia pedidos em seu nome" on public.friendships;
create policy "Cada um envia pedidos em seu nome"
  on public.friendships for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');

drop policy if exists "Qualquer um dos dois pode desfazer" on public.friendships;
create policy "Qualquer um dos dois pode desfazer"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Nao existe regra de UPDATE de proposito: aceitar um pedido so acontece pela funcao abaixo.

-- 2) Funcoes de apoio
create or replace function public.is_friend(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = (select auth.uid()) and f.addressee = other)
        or (f.requester = other and f.addressee = (select auth.uid())))
  );
$$;

create or replace function public.has_link(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester = (select auth.uid()) and f.addressee = other)
       or (f.requester = other and f.addressee = (select auth.uid()))
  );
$$;

-- Aceitar um pedido: so quem RECEBEU o pedido consegue, e so muda de pendente para aceito
create or replace function public.accept_friend(other uuid)
returns void language sql security definer set search_path = '' as $$
  update public.friendships
     set status = 'accepted'
   where requester = other and addressee = (select auth.uid()) and status = 'pending';
$$;

-- Procurar alguem pelo @ exato, para poder pedir amizade (devolve so o cartao basico)
create or replace function public.find_user(name text)
returns table (id uuid, username text, display_name text, avatar text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar
    from public.profiles p
   where p.username = lower(trim(leading '@' from name))
     and p.id <> (select auth.uid());
$$;

revoke all on function public.is_friend(uuid) from public, anon;
revoke all on function public.has_link(uuid) from public, anon;
revoke all on function public.accept_friend(uuid) from public, anon;
revoke all on function public.find_user(text) from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.has_link(uuid) to authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;
grant execute on function public.find_user(text) to authenticated;

-- 3) Perfil completo: so o dono, os amigos e quem tem pedido pendente com ele
drop policy if exists "Quem esta logado ve os perfis" on public.profiles;
drop policy if exists "Perfil visivel para o dono e para os amigos" on public.profiles;
create policy "Perfil visivel para o dono e para os amigos"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_link(id));

-- 4) Filmes: o dono ve e altera os seus; amigos aceitos so conseguem ver
drop policy if exists "Cada um ve so os proprios filmes" on public.films;
drop policy if exists "Ve os proprios filmes e os dos amigos" on public.films;
create policy "Ve os proprios filmes e os dos amigos"
  on public.films for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend(user_id));