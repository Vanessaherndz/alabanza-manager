# Alabanza Manager

Aplicación web para organizar, planificar y gestionar los servicios de los
equipos de alabanza en las iglesias.

- **Frontend:** React 18 + Vite + React Router (`frontend/`)
- **Backend:** NestJS + Firebase Admin SDK (`backend/`)
- **Base de datos y autenticación:** Firebase (Firestore + Firebase Auth)
- **Arquitectura:** MVC — ver [Arquitectura](#arquitectura) más abajo
- **Multi-iglesia:** cada iglesia es un espacio aislado; un usuario puede
  pertenecer a varias con un rol distinto en cada una (`admin` / `user`).
- **Administrador del sistema:** rol global (`users/{uid}.isSystemAdmin`) que
  ve y gestiona todas las iglesias y todas las cuentas.
- **Autenticación:** solo **usuario + contraseña**. No hay registro público:
  el administrador crea cada cuenta desde **Miembros**. Por debajo, cada
  usuario se mapea a un correo sintético `usuario@alabanza-manager.com`
  (nunca se muestra ni recibe correo).

## Arquitectura

El proyecto es un monorepo con dos aplicaciones independientes:

```
alabanza-manager/
  backend/     API REST en NestJS (Controller -> Service -> Firestore)
  frontend/    SPA en React que consume esa API + Firebase Auth
  firebase.json, firestore.rules, firestore.indexes.json   (config de Firebase)
```

El frontend **nunca** toca Firestore directamente: solo usa el SDK de
Firebase para el login (Firebase Auth) y llama al backend por HTTP para
todo lo demás. El backend usa el **Admin SDK** de Firebase, que ignora las
reglas de seguridad de Firestore — por eso `firestore.rules` niega todo el
acceso de clientes (defensa en profundidad).

Dentro del backend, cada módulo de NestJS sigue el patrón MVC:

- **Controller** (`*.controller.ts`): recibe la petición HTTP, valida el
  DTO y decide qué status/JSON devolver — es la capa de "vista" de una API.
- **Service** (`*.service.ts`): la lógica de negocio; es quien lee y
  escribe en Firestore.
- **Modelo**: los documentos de Firestore, con la forma que describen los
  DTOs (`dto/*.ts`) y las interfaces de cada `*.service.ts`.

Los guards (`common/guards/firebase-auth.guard.ts`) y servicios compartidos
(`common/church-access.service.ts`, `common/profiles.service.ts`) resuelven
autenticación y permisos por iglesia antes de que un controller llegue a
tocar datos.

## Modelo de datos (Firestore)

| Colección                          | Descripción                                                        |
| ----------------------------------- | ------------------------------------------------------------------- |
| `users/{uid}`                       | Perfil visible (`username`, `fullName`, `phone`, `isSystemAdmin`)  |
| `churches/{id}`                     | La iglesia (tenant)                                                |
| `memberships/{churchId}_{uid}`      | Pertenencia + rol (`admin` / `user`) de un usuario en una iglesia  |
| `teams/{id}`                        | Equipos de alabanza de una iglesia                                 |
| `songs/{id}`                        | Repertorio de la iglesia                                           |
| `events/{id}`                       | Servicios (`type: 'servicio'`)                                     |
| `events/{id}/songs/{id}`            | Setlist del servicio; `section` = momento (Bienvenida, Adoración…) |
| `events/{id}/assignments/{id}`      | Quién participa y su estado (`invitado` / `confirmado` / `rechazado`) |

La cuenta de autenticación en sí (correo sintético + contraseña) vive en
Firebase Auth, no en Firestore; `users/{uid}` solo guarda el perfil.

## Conectar el proyecto a Firebase

### 1. Crear el proyecto

1. Ve a <https://console.firebase.google.com> y crea un proyecto nuevo.
2. En **Build → Firestore Database**, crea la base en **modo producción**
   (las reglas ya vienen bloqueadas en `firestore.rules`, así que "producción"
   es correcto incluso en desarrollo).
3. En **Build → Authentication → Sign-in method**, habilita el proveedor
   **Correo electrónico/contraseña**. No hace falta activar verificación de
   correo (los correos son sintéticos).

### 2. Credenciales para el backend (Admin SDK)

1. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave
   privada**. Descarga el JSON.
2. Copia `backend/.env.example` a `backend/.env` y completa con los datos
   del JSON:
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key` (pégala tal cual, entre comillas)
3. Ajusta `USERNAME_DOMAIN` si quieres otro dominio sintético y
   `FRONTEND_ORIGIN` con la URL del frontend (para CORS).

**No subas ese JSON ni el `.env` al repositorio** (ya están en `.gitignore`).

### 3. Credenciales para el frontend (Web SDK)

1. **Configuración del proyecto → Tus apps → Agregar app → Web** (el ícono
   `</>`). No hace falta Firebase Hosting para esto.
2. Copia el objeto `firebaseConfig` que te muestra.
3. Copia `frontend/.env.example` a `frontend/.env` y completa `apiKey`,
   `authDomain` y `projectId`. Estos valores **no son secretos** (identifican
   el proyecto, no dan acceso privilegiado); es normal que viajen al navegador.
4. `VITE_API_URL` debe apuntar al backend (`http://localhost:3000` en local).

### 4. Instalar y ejecutar

```bash
# Backend
cd backend
npm install
npm run start:dev
```

```bash
# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Abre <http://localhost:5173>.

### 5. Crear el primer administrador

No hay registro público, así que la primera cuenta se crea con un script:

```bash
cd backend
# En backend/.env define SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD / SEED_ADMIN_FULL_NAME
npm run seed:admin
```

Esto crea (o actualiza) la cuenta en Firebase Auth y la marca como
administrador del sistema en Firestore. Inicia sesión en `/login` con ese
usuario y contraseña.

### 6. (Opcional) Desplegar reglas e índices de Firestore

```bash
npm install -g firebase-tools   # una sola vez
firebase login
firebase use --add              # elige tu proyecto
firebase deploy --only firestore:rules,firestore:indexes
```

No es obligatorio para desarrollar (Firestore te deja crear los índices
compuestos desde el link que aparece en el error la primera vez que corres
una consulta que los necesita), pero es la forma reproducible de hacerlo.

## Primer uso

1. Inicia sesión con la cuenta creada por `npm run seed:admin`.
2. En el panel, crea tu iglesia: pasas a ser su **administrador**.
3. Como admin: crea equipos, canciones y servicios. En **Miembros** creas
   las cuentas del equipo (usuario + contraseña) y les compartes las
   credenciales.
4. Un **usuario** ve la programación, los setlists y confirma su
   participación en cada servicio.

## Estructura

```
backend/
  src/
    firebase/          Inicializa el Admin SDK (Auth + Firestore) como módulo global
    common/             Guard de autenticación, decorador @CurrentUser,
                         ChurchAccessService (roles por iglesia), ProfilesService
    auth/               GET /auth/me
    churches/           POST/GET /churches, GET /churches/:id
    members/            CRUD de miembros de una iglesia (crear cuenta, vincular, rol)
    teams/              CRUD de equipos
    songs/              CRUD del repertorio
    events/             Servicios: setlist y asignaciones
    dashboard/          Resumen del panel y calendario mensual
    scripts/seed-admin.ts   Crea el primer administrador del sistema
frontend/
  src/
    lib/
      firebaseClient.js  Inicializa Firebase Auth en el navegador
      apiClient.js       fetch con el ID token de Firebase adjunto
      username.js        usuario <-> correo sintético
      serviceSections.js Momentos del servicio
      serviceRoles.js    Instrumentos fijos + Cantante
    context/
      AuthContext.jsx    Sesión (Firebase Auth) + perfil (GET /auth/me)
      ChurchContext.jsx  Iglesia activa y rol (API del backend)
    components/
      ProtectedRoute.jsx Exige sesión
      RoleRoute.jsx      Exige rol (admin de iglesia o admin del sistema)
      Layout/            Barra lateral + selector de iglesia
      EventManager.jsx   Lista de servicios
    pages/
      Login, Dashboard, Services/ServiceForm/ServiceDetail, Teams, Songs, Members
```

## Siguientes pasos sugeridos

- Vista de calendario con rango de varios meses.
- Notificaciones (correo / push) al confirmar asignaciones.
- Invitaciones para usuarios que aún no tienen cuenta.
- Tests end-to-end del flujo servicio → setlist → asignaciones.
