# Alabanza Manager

Base de una aplicación web para organizar, planificar y gestionar los servicios y
ensayos de los equipos de alabanza en las iglesias.

- **Frontend:** React 18 + Vite + React Router (JavaScript, CSS Modules)
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Multi-iglesia:** cada iglesia es un espacio aislado; un usuario puede pertenecer
  a varias con un rol distinto en cada una.
- **Roles por iglesia:** `admin` (gestiona todo) y `user` (usuario base).
- **Administrador del sistema:** rol global (`profiles.is_system_admin`) que ve y
  gestiona todas las iglesias y todas las cuentas.
- **Autenticación:** solo **usuario + contraseña**. No hay registro público: el
  administrador crea cada cuenta desde **Miembros**. Por debajo, cada usuario se
  mapea a un correo sintético `usuario@alabanza.local` (nunca se muestra ni recibe
  correo).

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto de Supabase

1. Crea un proyecto en <https://supabase.com>.
2. En **SQL Editor**, pega y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql).
   Si ya lo habías ejecutado antes, corre además
   [`supabase/patch_01_username_system_admin.sql`](supabase/patch_01_username_system_admin.sql).
3. En **Project Settings → API** copia la _Project URL_ y la _anon public key_.
4. **Obligatorio.** En **Authentication → Providers → Email** desactiva **"Confirm email"**
   (los correos son sintéticos y no reciben mensajes) y deja activado
   **"Allow new users to sign up"** (el alta de cuentas del admin lo usa por debajo).

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

1. Crea la primera cuenta en **Authentication → Users → Add user** (marca
   _Auto Confirm User_) y ejecuta `supabase/patch_01_username_system_admin.sql`:
   deja a ese usuario como **administrador del sistema** (paso 7 del patch) y le
   asigna un `username`.
2. Inicia sesión en `/login` con ese usuario y contraseña.
3. En el panel, crea tu iglesia: pasas a ser su **administrador**.
4. Como admin: crea equipos, canciones, servicios y ensayos. En **Miembros**
   creas las cuentas del equipo (usuario + contraseña) y les pasas las credenciales.
5. Un **usuario** ve la programación, los setlists y marca su disponibilidad.

## Estructura

```
src/
  lib/
    supabaseClient.js        Cliente de Supabase (lee las env VITE_*)
    adminClient.js           Cliente efímero para crear cuentas sin cerrar sesión
    username.js              usuario <-> correo sintético (usuario@alabanza.local)
  context/
    AuthContext.jsx          Sesión + perfil: signIn / createAccount / signOut
    ChurchContext.jsx        Iglesia activa, membresías y rol
  components/
    ProtectedRoute.jsx       Exige sesión
    RoleRoute.jsx            Exige rol (admin de iglesia o admin del sistema)
    Layout/                   Barra lateral + selector de iglesia
    EventManager.jsx         CRUD compartido de servicios / ensayos
  pages/
    Login                    Entrar con usuario + contraseña
    Dashboard                Resumen + crear iglesia
    Services / Rehearsals    Eventos (type = servicio | ensayo)
    Teams                    Equipos de alabanza
    Songs                    Repertorio (CRUD completo de ejemplo)
    Availability             Disponibilidad propia por fecha
    Members                  Gestión de miembros y roles (solo admin)
supabase/
  schema.sql                 Tablas, tipos, funciones RPC y políticas RLS
  patch_01_username_system_admin.sql   Migración: usuario + admin del sistema
```

## Modelo de datos

| Tabla                | Descripción                                             |
| -------------------- | ------------------------------------------------------- |
| `profiles`           | 1:1 con `auth.users`; `username` visible + `is_system_admin` |
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
- `add_member_by_username(_church_id, _username, _role)` – agrega/actualiza un miembro (solo admin).
- `is_system_admin()` – `true` si el usuario actual es administrador del sistema.

Toda la seguridad se aplica con **RLS**: los miembros solo ven los datos de sus
iglesias y solo los `admin` pueden crear/editar/borrar.

## Siguientes pasos sugeridos

- Pantalla de detalle de evento: armar setlist (`event_songs`) y asignar personas
  (`event_assignments`) con arrastrar y soltar.
- Vista de calendario mensual.
- Notificaciones (correo / push) al confirmar asignaciones.
- Invitaciones para usuarios que aún no tienen cuenta (tabla `invitations`).
```
