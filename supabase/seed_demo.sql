-- =============================================================================
-- Seed de DEMO - canciones y usuarios de prueba
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase. Es repetible (no duplica).
--
--   * Se añade a la PRIMERA iglesia. Para elegir otra, descomenta la línea
--     "where name = '...'" de abajo.
--   * Contraseña de TODOS los usuarios demo: demo1234
--   * Los usuarios inician sesión con su usuario (samuel, maicol, ...).
--
-- Para borrar la demo, ejecuta el bloque comentado del final.
-- =============================================================================

do $$
declare
  cid  uuid;
  d    record;
  uid  uuid;
  correo text;
begin
  select id into cid
  from public.churches
  -- where name = 'Multitudes'
  order by created_at
  limit 1;

  if cid is null then
    raise exception 'No hay ninguna iglesia. Crea una primero.';
  end if;

  -- ------------------------- Canciones -------------------------
  insert into public.songs (church_id, title, artist, song_key, bpm)
  select cid, s.title, s.artist, s.song_key, s.bpm
  from (values
    ('María tomó el pandero',        NULL, 'D',  128),
    ('Entonces la Iglesia',          NULL, 'E',  120),
    ('Los enemigos de Jehová',       NULL, 'Am', 135),
    ('Cánticos nuevos',              NULL, 'G',  130),
    ('No basta',                     NULL, 'C',   72),
    ('Hay una fuente en mí',         NULL, 'D',   68),
    ('Mis enemigos volvieron atrás', NULL, 'Em', 138),
    ('Creo en ti',                   NULL, 'A',   74),
    ('Dios el más grande',           NULL, 'B',   76),
    ('Fiesta en el desierto',        NULL, 'G',  125),
    ('Toda la noche sin parar',      NULL, 'A',  132),
    ('El Señor es mi Rey',           NULL, 'C',   78)
  ) as s(title, artist, song_key, bpm)
  where not exists (
    select 1 from public.songs x
    where x.church_id = cid and lower(x.title) = lower(s.title)
  );

  -- ------------------------- Usuarios -------------------------
  for d in
    select * from (values
      ('samuel',  'Samuel Pérez',    'Piano'),
      ('maicol',  'Maicol Gómez',    'Guitarra eléctrica'),
      ('josue',   'Josué Ramírez',   'Bajo'),
      ('emely',   'Emely Torres',    'Batería'),
      ('esmy',    'Esmy Castillo',   'Cantante'),
      ('vannesa', 'Vannesa Herrera', 'Cantante')
    ) as t(username, full_name, instrumento)
  loop
    correo := d.username || '@alabanza-manager.com';
    select id into uid from auth.users where email = correo;

    if uid is null then
      uid := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        uid, 'authenticated', 'authenticated', correo,
        crypt('demo1234', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('username', d.username, 'full_name', d.full_name),
        now(), now()
      );

      insert into auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        uid::text, uid,
        jsonb_build_object(
          'sub', uid::text, 'email', correo, 'email_verified', true
        ),
        'email', now(), now(), now()
      );
    end if;

    -- el trigger handle_new_user ya creó el profile; reforzamos los datos
    update public.profiles
      set username = d.username, full_name = d.full_name
      where id = uid;

    insert into public.church_members (church_id, profile_id, role, instruments)
    values (cid, uid, 'user', array[d.instrumento])
    on conflict (church_id, profile_id) do nothing;
  end loop;
end $$;

-- Resultado
select 'canciones en la iglesia' as dato, count(*)::text as valor
  from public.songs s
  join public.churches c on c.id = s.church_id
union all
select 'miembros demo', count(*)::text
  from public.church_members cm
  join public.profiles p on p.id = cm.profile_id
  where p.username in ('samuel','maicol','josue','emely','esmy','vannesa');

-- =============================================================================
-- Para BORRAR la demo (descomenta y ejecuta):
-- =============================================================================
-- delete from auth.users
--   where email in (
--     'samuel@alabanza-manager.com','maicol@alabanza-manager.com',
--     'josue@alabanza-manager.com','emely@alabanza-manager.com',
--     'esmy@alabanza-manager.com','vannesa@alabanza-manager.com'
--   );
-- delete from public.songs
--   where title in (
--     'María tomó el pandero','Entonces la Iglesia','Los enemigos de Jehová',
--     'Cánticos nuevos','No basta','Hay una fuente en mí',
--     'Mis enemigos volvieron atrás','Creo en ti','Dios el más grande',
--     'Fiesta en el desierto','Toda la noche sin parar','El Señor es mi Rey'
--   );
