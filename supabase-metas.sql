-- Lanterninha: meta de filmes por ano ("2026 em filmes").
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".
-- Pode rodar mais de uma vez sem problema. A meta é pessoal: só o dono lê e muda.

create table if not exists public.goals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year smallint not null check (year between 1900 and 2200),
  films smallint not null check (films between 1 and 9999),
  updated_at timestamptz not null default now(),
  primary key (user_id, year)
);

alter table public.goals enable row level security;

drop policy if exists "goals: ler a sua" on public.goals;
create policy "goals: ler a sua" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals: criar a sua" on public.goals;
create policy "goals: criar a sua" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals: mudar a sua" on public.goals;
create policy "goals: mudar a sua" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals: tirar a sua" on public.goals;
create policy "goals: tirar a sua" on public.goals
  for delete using (auth.uid() = user_id);
