-- =============================================================================
-- Patch 03 - Momento del servicio para cada asignación de equipo
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase, después de patch_02.
-- Idempotente.
--
-- Igual que event_songs.section (patch 02), cada asignación de equipo
-- (event_assignments) ahora puede indicar a qué momento del servicio
-- pertenece (Bienvenida, Adoración, Júbilo, Despedida...), para poder armar
-- el servicio momento por momento: quién canta y quién toca en cada uno.
--
-- Las asignaciones antiguas (o las que se agreguen sin momento, como
-- "Dirección") quedan con section = NULL, es decir "para todo el servicio".
-- =============================================================================

alter table public.event_assignments add column if not exists section text;

-- Antes: una persona solo podía tener un rol una vez por evento.
-- Ahora: una persona puede repetir el mismo rol si es en un momento distinto.
alter table public.event_assignments
  drop constraint if exists event_assignments_event_id_profile_id_role_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_assignments_event_profile_role_section_key'
  ) then
    alter table public.event_assignments
      add constraint event_assignments_event_profile_role_section_key
      unique (event_id, profile_id, role, section);
  end if;
end $$;
