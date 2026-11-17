-- Lanterninha: média das notas de todo mundo para um filme, sem mostrar a nota de ninguém.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".

-- A função roda com permissão de dono (security definer) para conseguir ler as notas de todos,
-- mas só devolve a média e a quantidade de avaliações.
create or replace function public.film_average(film_key text)
returns table(avg numeric, n integer)
language sql stable security definer set search_path = public as $$
  select round(avg((f.data->>'s')::numeric), 1), count(*)::integer
  from public.films f
  where f.key = film_key
    and jsonb_typeof(f.data->'s') = 'number'
    and (f.data->>'s')::numeric between 0.5 and 5
    and not (f.data ? 'st')
$$;

revoke all on function public.film_average(text) from public;
grant execute on function public.film_average(text) to anon, authenticated;

-- Deixa a busca por filme rápida mesmo com muitos usuários
create index if not exists films_key_idx on public.films (key);

-- Distribuição das notas (quantas pessoas deram cada nota), para o gráfico da página do filme.
-- Também só devolve contagens, nunca quem deu cada nota.
create or replace function public.film_stats(film_key text)
returns table(s numeric, n integer)
language sql stable security definer set search_path = public as $$
  select (f.data->>'s')::numeric, count(*)::integer
  from public.films f
  where f.key = film_key
    and jsonb_typeof(f.data->'s') = 'number'
    and (f.data->>'s')::numeric in (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
    and not (f.data ? 'st')
  group by 1
$$;

revoke all on function public.film_stats(text) from public;
grant execute on function public.film_stats(text) to anon, authenticated;
