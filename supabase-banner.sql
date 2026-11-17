-- Lanterninha: banner do perfil (o caminho de uma imagem do TMDB, ex.: /abc123.jpg).
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".

alter table public.profiles
  add column if not exists banner text;

-- Só aceita um caminho de imagem do TMDB, para ninguém guardar outra coisa aqui
alter table public.profiles
  drop constraint if exists profiles_banner_shape;

alter table public.profiles
  add constraint profiles_banner_shape check (banner is null or banner ~ '^/[A-Za-z0-9_-]{5,60}\.(jpg|png)$');
