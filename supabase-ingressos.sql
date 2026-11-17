-- Lanterninha: "Amigo confirma" no ingresso.
-- Quando você marca um amigo no ingresso, ele recebe um aviso: "Fulano disse que vocês viram X juntos".
-- Se ele confirmar, o ingresso entra na gaveta dele também.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".
-- Pode rodar mais de uma vez sem problema. Só cria coisas novas, não mexe no que já existe.

create table if not exists public.cine_tags (
  id bigint generated always as identity primary key,
  from_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  film_key text not null check (char_length(film_key) between 1 and 40),
  film jsonb not null check (jsonb_typeof(film) = 'object' and pg_column_size(film) < 2000),
  cine text check (char_length(cine) <= 60),
  seen text check (seen ~ '^\d{4}-\d{2}-\d{2}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id, film_key),
  check (from_id <> to_id)
);

alter table public.cine_tags enable row level security;

-- Só quem marcou e quem foi marcado enxergam o aviso (os nomes não aparecem para mais ninguém)
drop policy if exists "cine_tags: envolvidos leem" on public.cine_tags;
create policy "cine_tags: envolvidos leem" on public.cine_tags
  for select using (auth.uid() = from_id or auth.uid() = to_id);

-- Só dá para marcar amigos de verdade, e o aviso sempre nasce "pendente"
drop policy if exists "cine_tags: marcar amigo" on public.cine_tags;
create policy "cine_tags: marcar amigo" on public.cine_tags
  for insert with check (
    from_id = auth.uid() and status = 'pending'
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = from_id and f.addressee = to_id) or (f.requester = to_id and f.addressee = from_id))
    )
  );

-- Quem marcou pode desmarcar, e quem foi marcado pode apagar o aviso
drop policy if exists "cine_tags: apagar" on public.cine_tags;
create policy "cine_tags: apagar" on public.cine_tags
  for delete using (auth.uid() = from_id or auth.uid() = to_id);

-- Responder ao aviso ("sim, eu fui" ou "não fui"). Só quem foi marcado consegue, e só muda o status.
create or replace function public.answer_cine_tag(tag_id bigint, ok boolean)
returns void
language sql volatile security definer set search_path = public as $$
  update public.cine_tags
  set status = case when ok then 'accepted' else 'declined' end
  where id = tag_id and to_id = auth.uid() and status = 'pending';
$$;

revoke all on function public.answer_cine_tag(bigint, boolean) from public, anon;
grant execute on function public.answer_cine_tag(bigint, boolean) to authenticated;
