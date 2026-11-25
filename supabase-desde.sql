-- Lanterninha: trava a data de criação do perfil (usada no "No Lanterninha desde…").
-- A coluna profiles.created_at já existe e nasce igual à data do cadastro (auth.users).
-- Este script só impede que ela seja mudada depois, por qualquer caminho (app ou API).
-- Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto e clique em "Run".

create or replace function public.profiles_manter_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_manter_created_at on public.profiles;
create trigger profiles_manter_created_at
before update on public.profiles
for each row execute function public.profiles_manter_created_at();
