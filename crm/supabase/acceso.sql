-- =====================================================================
--  ASOSIA CRM · Solo pueden entrar los correos autorizados
--  Pegá este archivo en Supabase → SQL Editor → Run (después de schema.sql).
-- =====================================================================

-- ¿Este correo puede entrar? La pantalla de login lo pregunta antes de mandar el código
-- o de intentar la contraseña. Solo responde sí/no.
create or replace function correo_autorizado(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from autorizados where email = lower(trim(coalesce(p_email, ''))) and activo)
$$;
revoke all on function correo_autorizado(text) from public;
grant execute on function correo_autorizado(text) to anon, authenticated;

-- Bloqueo en la base: Supabase no crea cuentas para correos que no están autorizados,
-- aunque alguien intente saltarse la app.
create or replace function public._solo_autorizados() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.autorizados where email = lower(trim(coalesce(new.email, ''))) and activo) then
    raise exception 'Correo no autorizado';
  end if;
  return new;
end $$;
revoke all on function public._solo_autorizados() from public, anon, authenticated;

drop trigger if exists t_solo_autorizados on auth.users;
create trigger t_solo_autorizados before insert on auth.users
  for each row execute function public._solo_autorizados();

-- Para revisar: cuentas que ya se crearon con correos no autorizados
-- select email, created_at, last_sign_in_at from auth.users
--   where lower(email) not in (select email from public.autorizados)
--   order by created_at;
