-- =============================================================================
-- Patch 02 - Momento del servicio para cada alabanza
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase, después de patch_01.
-- Idempotente.
--
-- Cada fila del setlist (event_songs) puede clasificarse en un "momento" del
-- servicio: Bienvenida, Adoración, Júbilo, Despedida, ... El valor es texto
-- libre; la lista la controla el frontend (src/lib/serviceSections.js).
-- =============================================================================

alter table public.event_songs add column if not exists section text;
