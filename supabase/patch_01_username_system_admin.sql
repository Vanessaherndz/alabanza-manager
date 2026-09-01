-- =============================================================================
-- Patch 01 - Autenticación por usuario + Administrador del sistema
-- =============================================================================
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de schema.sql.
-- Idempotente: se puede volver a ejecutar sin romper nada.
--
-- REQUISITO: Authentication -> Providers -> Email -> "Confirm email" = OFF
-- (los correos son sintéticos: usuario@alabanza.local y no reciben mensajes).
-- =============================================================================

-- 1. profiles: usuario visible + marca de admin del sistema ----------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists is_system_admin boolean not null default false;

create unique index if not exists profiles_username_key
  on public.profiles (lower(username));

-- 2. El perfil copia usuario / nombre / teléfono desde los metadatos del signUp --
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, username, phone)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'username',
      new.email
    ),
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update set
    email     = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    username  = coalesce(excluded.username, public.profiles.username),
    phone     = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$;

-- 3. ¿El usuario actual es admin del sistema? ----------------------------------
create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_system_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_system_admin() to authenticated;

-- 4. El admin del sistema pasa TODOS los chequeos por iglesia -----------------
create or replace function public.is_church_member(_church_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_system_admin() or exists (
    select 1 from public.church_members cm
    where cm.church_id = _church_id and cm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_church_admin(_church_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_system_admin() or exists (
    select 1 from public.church_members cm
    where cm.church_id = _church_id
      and cm.profile_id = auth.uid()
      and cm.role = 'admin'
  );
$$;

-- 5. El admin del sistema ve y edita todos los perfiles ----------------------
drop policy if exists "profiles: system admin ve todo" on public.profiles;
create policy "profiles: system admin ve todo" on public.profiles
  for select using (public.is_system_admin());

drop policy if exists "profiles: system admin gestiona" on public.profiles;
create policy "profiles: system admin gestiona" on public.profiles
  for update using (public.is_system_admin()) with check (public.is_system_admin());

-- 6. Agregar miembro por usuario (sustituye a add_member_by_email) ------------
drop function if exists public.add_member_by_email(uuid, text, public.app_role);

create or replace function public.add_member_by_username(
  _church_id uuid,
  _username  text,
  _role      public.app_role default 'user'
)
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.is_church_admin(_church_id) then
    raise exception 'Solo un administrador puede agregar miembros';
  end if;

  select id into target from public.profiles
  where lower(username) = lower(trim(_username));

  if target is null then
    raise exception 'No existe un usuario con el nombre "%"', _username;
  end if;

  insert into public.church_members (church_id, profile_id, role)
  values (_church_id, target, _role)
  on conflict (church_id, profile_id) do update set role = excluded.role;
end;
$$;
grant execute on function public.add_member_by_username(uuid, text, public.app_role) to authenticated;

-- 7. Marca al administrador del sistema --------------------------------------
--    Por defecto: el primer usuario que se registró.
--    Si prefieres, cámbialo por:  where email = 'tucorreo@ejemplo.com'
update public.profiles
set is_system_admin = true
where id = (select id from auth.users order by created_at asc limit 1);

-- 8. (OPCIONAL) Convierte al admin creado con correo real al esquema de usuario
--    para que entre solo con "admin". Descomenta y ajusta el correo si lo quieres.
-- update auth.users
--   set email = 'admin@alabanza.local',
--       raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"username":"admin"}'::jsonb
--   where email = 'admin@local.test';
-- update auth.identities
--   set identity_data = identity_data || '{"email":"admin@alabanza.local"}'::jsonb
--   where provider = 'email' and identity_data ->> 'email' = 'admin@local.test';
-- update public.profiles
--   set username = 'admin', email = 'admin@alabanza.local'
--   where email = 'admin@local.test';

-- Comprobación
select id, username, email, is_system_admin from public.profiles order by created_at;
