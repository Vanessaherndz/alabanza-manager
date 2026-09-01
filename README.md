# Alabanza Manager

Base de una aplicación web para organizar, planificar y gestionar los servicios y
ensayos de los equipos de alabanza en las iglesias.

- **Frontend:** React 18 + Vite + React Router (JavaScript, CSS Modules)
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Multi-iglesia:** cada iglesia es un espacio aislado; un usuario puede pertenecer
  a varias con un rol distinto en cada una.
- **Roles por iglesia:** `admin` (gestiona todo) y `user` (usuario base).

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto de Supabase

1. Crea un proyecto en <https://supabase.com>.
2. En **SQL Editor**, pega y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. En **Project Settings → API** copia la _Project URL_ y la _anon public key_.
4. (Opcional para desarrollo) En **Authentication → Providers → Email**, desactiva
   "Confirm email" para poder iniciar sesión inmediatamente tras registrarte.

### 3. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

### 4. Ejecutar

```bash
npm run dev
```

Abre <http://localhost:5173>.

## Primer uso

1. Regístrate en `/register`.
2. En el panel, crea tu iglesia: pasas a ser su **administrador**.
3. Como admin: crea equipos, canciones, servicios y ensayos, y agrega miembros
   por correo en **Miembros** (deben haberse registrado antes).
4. Un **usuario** ve la programación, los setlists y marca su disponibilidad.

## Estructura

```
src/
  lib/supabaseClient.js      Cliente de Supabase (lee las env VITE_*)
  context/
    AuthContext.jsx          Sesión: signIn / signUp / signOut
    ChurchContext.jsx        Iglesia activa, membresías y rol
  components/
    ProtectedRoute.jsx       Exige sesión
    RoleRoute.jsx            Exige rol (p. ej. admin)
    Layout/                   Barra lateral + selector de iglesia
    EventManager.jsx         CRUD compartido de servicios / ensayos
  pages/
    Login / Register
    Dashboard                Resumen + crear iglesia
    Services / Rehearsals    Eventos (type = servicio | ensayo)
    Teams                    Equipos de alabanza
    Songs                    Repertorio (CRUD completo de ejemplo)
    Availability             Disponibilidad propia por fecha
    Members                  Gestión de miembros y roles (solo admin)
supabase/
  schema.sql                 Tablas, tipos, funciones RPC y políticas RLS
```

## Modelo de datos

| Tabla                | Descripción                                             |
| -------------------- | ------------------------------------------------------- |
| `profiles`           | 1:1 con `auth.users` (se crea por trigger al registrarse) |
| `churches`           | La iglesia (tenant)                                    |
| `church_members`     | Pertenencia + rol (`admin` / `user`) por iglesia       |
| `teams`              | Equipos de alabanza de una iglesia                     |
| `team_members`       | Integrantes de cada equipo y sus roles/instrumentos    |
| `songs`              | Repertorio de la iglesia                               |
| `events`             | Servicios y ensayos (`type`), un ensayo puede colgar de un servicio |
| `event_songs`        | Setlist de cada evento                                 |
| `event_assignments`  | Quién participa en cada evento y su confirmación       |
| `availability`       | Disponibilidad de cada integrante por fecha            |

### Funciones RPC

- `create_church(_name, _city)` – crea la iglesia y te deja como `admin`.
- `add_member_by_email(_church_id, _email, _role)` – agrega/actualiza un miembro (solo admin).

Toda la seguridad se aplica con **RLS**: los miembros solo ven los datos de sus
iglesias y solo los `admin` pueden crear/editar/borrar.

## Siguientes pasos sugeridos

- Pantalla de detalle de evento: armar setlist (`event_songs`) y asignar personas
  (`event_assignments`) con arrastrar y soltar.
- Vista de calendario mensual.
- Notificaciones (correo / push) al confirmar asignaciones.
- Invitaciones para usuarios que aún no tienen cuenta (tabla `invitations`).
```
