-- Lanterninha: curtir a review de um amigo.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".
-- Pode rodar mais de uma vez sem problema. Só cria coisas novas, não mexe no que já existe.

create table if not exists public.review_likes (
  author_id uuid not null references auth.users(id) on delete cascade,   -- quem escreveu a review
  film_key text not null check (char_length(film_key) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, -- quem curtiu
  created_at timestamptz not null default now(),
  primary key (author_id, film_key, user_id),
  check (author_id <> user_id)
);

create index if not exists review_likes_film on public.review_likes (film_key);

alter table public.review_likes enable row level security;

-- Quem enxerga as curtidas: quem escreveu, quem curtiu e os amigos de quem escreveu
drop policy if exists "review_likes: ler" on public.review_likes;
create policy "review_likes: ler" on public.review_likes
  for select using (
    auth.uid() = author_id or auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = author_id) or (f.requester = author_id and f.addressee = auth.uid()))
    )
  );

-- Curtir: só em seu próprio nome e só a review de um amigo
drop policy if exists "review_likes: curtir" on public.review_likes;
create policy "review_likes: curtir" on public.review_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = author_id) or (f.requester = author_id and f.addressee = auth.uid()))
    )
  );

-- Descurtir: só a sua própria curtida
drop policy if exists "review_likes: descurtir" on public.review_likes;
create policy "review_likes: descurtir" on public.review_likes
  for delete using (user_id = auth.uid());
