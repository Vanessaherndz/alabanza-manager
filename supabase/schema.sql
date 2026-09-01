-- =============================================================================
-- Alabanza Manager - Esquema inicial (multi-iglesia)
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase (o con `supabase db push`).
-- Modelo: cada iglesia (church) es un "tenant" aislado. Un perfil puede
-- pertenecer a varias iglesias con un rol distinto en cada una.
-- Roles por iglesia: 'admin' (gestiona todo) y 'user' (usuario base).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_type as enum ('servicio', 'ensayo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assignment_status as enum ('invitado', 'confirmado', 'rechazado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.availability_status as enum ('disponible', 'no_disponible');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Utilidad: updated_at automatico
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: 1:1 con auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil automaticamente cuando se registra un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- churches: el tenant
-- -----------------------------------------------------------------------------
create table if not exists public.churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger churches_set_updated_at
  before update on public.churches
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- church_members: pertenencia + rol por iglesia
-- -----------------------------------------------------------------------------
create table if not exists public.church_members (
  church_id   uuid not null references public.churches (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null default 'user',
  instruments text[] not null default '{}',
  joined_at   timestamptz not null default now(),
  primary key (church_id, profile_id)
);

create index if not exists church_members_profile_idx on public.church_members (profile_id);

-- -----------------------------------------------------------------------------
-- Helpers de seguridad (SECURITY DEFINER para evitar recursion de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_church_member(_church_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.church_members cm
    where cm.church_id = _church_id and cm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_church_admin(_church_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.church_members cm
    where cm.church_id = _church_id
      and cm.profile_id = auth.uid()
      and cm.role = 'admin'
  );
$$;

-- Crear una iglesia y quedar como admin (evita el problema del huevo y la gallina con RLS)
create or replace function public.create_church(_name text, _city text default null)
returns public.churches language plpgsql security definer set search_path = public as $$
declare
  new_church public.churches;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  insert into public.churches (name, city, created_by)
  values (_name, _city, auth.uid())
  returning * into new_church;

  insert into public.church_members (church_id, profile_id, role)
  values (new_church.id, auth.uid(), 'admin');

  return new_church;
end;
$$;

-- Agregar un miembro a la iglesia por su correo (debe estar registrado)
create or replace function public.add_member_by_email(
  _church_id uuid,
  _email text,
  _role public.app_role default 'user'
)
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.is_church_admin(_church_id) then
    raise exception 'Solo un administrador puede agregar miembros';
  end if;

  select id into target from auth.users where lower(email) = lower(_email);
  if target is null then
    raise exception 'No existe un usuario registrado con el correo %', _email;
  end if;

  insert into public.church_members (church_id, profile_id, role)
  values (_church_id, target, _role)
  on conflict (church_id, profile_id) do update set role = excluded.role;
end;
$$;

-- -----------------------------------------------------------------------------
-- teams: equipos de alabanza dentro de una iglesia
-- -----------------------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists teams_church_idx on public.teams (church_id);
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- team_members: integrantes de cada equipo
-- -----------------------------------------------------------------------------
create table if not exists public.team_members (
  team_id     uuid not null references public.teams (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  roles       text[] not null default '{}',   -- ej: {'voz','guitarra'}
  is_leader   boolean not null default false,
  added_at    timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create index if not exists team_members_profile_idx on public.team_members (profile_id);

-- -----------------------------------------------------------------------------
-- songs: repertorio de la iglesia
-- -----------------------------------------------------------------------------
create table if not exists public.songs (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches (id) on delete cascade,
  title         text not null,
  artist        text,
  song_key      text,          -- tonalidad, ej: 'G', 'Am'
  bpm           integer,
  ccli          text,
  reference_url text,
  lyrics        text,
  notes         text,
  tags          text[] not null default '{}',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists songs_church_idx on public.songs (church_id);
create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- events: servicios y ensayos
-- -----------------------------------------------------------------------------
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches (id) on delete cascade,
  team_id         uuid references public.teams (id) on delete set null,
  parent_event_id uuid references public.events (id) on delete set null, -- un ensayo puede colgar de un servicio
  type            public.event_type not null default 'servicio',
  title           text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  location        text,
  notes           text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists events_church_idx on public.events (church_id);
create index if not exists events_starts_at_idx on public.events (starts_at);
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- event_songs: setlist de cada evento
-- -----------------------------------------------------------------------------
create table if not exists public.event_songs (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  song_id    uuid not null references public.songs (id) on delete cascade,
  position   integer not null default 0,
  song_key   text,   -- tonalidad especifica para este evento (opcional)
  notes      text,
  unique (event_id, song_id)
);

create index if not exists event_songs_event_idx on public.event_songs (event_id);

-- -----------------------------------------------------------------------------
-- event_assignments: quien participa en cada evento y en que
-- -----------------------------------------------------------------------------
create table if not exists public.event_assignments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role        text,   -- ej: 'director', 'voz', 'bateria'
  status      public.assignment_status not null default 'invitado',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_id, profile_id, role)
);

create index if not exists event_assignments_event_idx on public.event_assignments (event_id);
create index if not exists event_assignments_profile_idx on public.event_assignments (profile_id);
create trigger event_assignments_set_updated_at
  before update on public.event_assignments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- availability: disponibilidad de cada integrante por fecha
-- -----------------------------------------------------------------------------
create table if not exists public.availability (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  date        date not null,
  status      public.availability_status not null default 'disponible',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (church_id, profile_id, date)
);

create index if not exists availability_church_date_idx on public.availability (church_id, date);
create trigger availability_set_updated_at
  before update on public.availability
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.churches          enable row level security;
alter table public.church_members    enable row level security;
alter table public.teams             enable row level security;
alter table public.team_members      enable row level security;
alter table public.songs             enable row level security;
alter table public.events            enable row level security;
alter table public.event_songs       enable row level security;
alter table public.event_assignments enable row level security;
alter table public.availability      enable row level security;

-- ---- profiles ----
create policy "profiles: leer propio" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: leer companeros de iglesia" on public.profiles
  for select using (
    exists (
      select 1
      from public.church_members me
      join public.church_members other on other.church_id = me.church_id
      where me.profile_id = auth.uid() and other.profile_id = public.profiles.id
    )
  );

create policy "profiles: actualizar propio" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---- churches ----
create policy "churches: leer si soy miembro" on public.churches
  for select using (public.is_church_member(id));

create policy "churches: actualizar si soy admin" on public.churches
  for update using (public.is_church_admin(id)) with check (public.is_church_admin(id));

create policy "churches: borrar si soy admin" on public.churches
  for delete using (public.is_church_admin(id));
-- El INSERT se hace via la funcion create_church().

-- ---- church_members ----
create policy "church_members: leer si comparto iglesia" on public.church_members
  for select using (public.is_church_member(church_id));

create policy "church_members: gestionar si soy admin" on public.church_members
  for all using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

-- ---- teams ----
create policy "teams: leer si soy miembro" on public.teams
  for select using (public.is_church_member(church_id));

create policy "teams: gestionar si soy admin" on public.teams
  for all using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

-- ---- team_members ----
create policy "team_members: leer si soy miembro de la iglesia" on public.team_members
  for select using (
    exists (select 1 from public.teams t
            where t.id = team_id and public.is_church_member(t.church_id))
  );

create policy "team_members: gestionar si soy admin" on public.team_members
  for all using (
    exists (select 1 from public.teams t
            where t.id = team_id and public.is_church_admin(t.church_id))
  ) with check (
    exists (select 1 from public.teams t
            where t.id = team_id and public.is_church_admin(t.church_id))
  );

-- ---- songs ----
create policy "songs: leer si soy miembro" on public.songs
  for select using (public.is_church_member(church_id));

create policy "songs: gestionar si soy admin" on public.songs
  for all using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

-- ---- events ----
create policy "events: leer si soy miembro" on public.events
  for select using (public.is_church_member(church_id));

create policy "events: gestionar si soy admin" on public.events
  for all using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

-- ---- event_songs ----
create policy "event_songs: leer si soy miembro" on public.event_songs
  for select using (
    exists (select 1 from public.events e
            where e.id = event_id and public.is_church_member(e.church_id))
  );

create policy "event_songs: gestionar si soy admin" on public.event_songs
  for all using (
    exists (select 1 from public.events e
            where e.id = event_id and public.is_church_admin(e.church_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_id and public.is_church_admin(e.church_id))
  );

-- ---- event_assignments ----
create policy "event_assignments: leer si soy miembro" on public.event_assignments
  for select using (
    exists (select 1 from public.events e
            where e.id = event_id and public.is_church_member(e.church_id))
  );

-- El admin gestiona todas las asignaciones de su iglesia
create policy "event_assignments: admin gestiona" on public.event_assignments
  for all using (
    exists (select 1 from public.events e
            where e.id = event_id and public.is_church_admin(e.church_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_id and public.is_church_admin(e.church_id))
  );

-- El usuario base puede responder (confirmar/rechazar) su propia asignacion
create policy "event_assignments: responder la propia" on public.event_assignments
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---- availability ----
create policy "availability: leer si soy miembro" on public.availability
  for select using (public.is_church_member(church_id));

create policy "availability: gestionar la propia" on public.availability
  for all using (
    profile_id = auth.uid() and public.is_church_member(church_id)
  ) with check (
    profile_id = auth.uid() and public.is_church_member(church_id)
  );

create policy "availability: admin gestiona" on public.availability
  for all using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

-- =============================================================================
-- Permisos de ejecucion de las funciones RPC
-- =============================================================================
grant execute on function public.create_church(text, text) to authenticated;
grant execute on function public.add_member_by_email(uuid, text, public.app_role) to authenticated;
grant execute on function public.is_church_member(uuid) to authenticated;
grant execute on function public.is_church_admin(uuid) to authenticated;
