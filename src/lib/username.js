// Alabanza Manager usa autenticación por "usuario + contraseña".
// Supabase Auth siempre necesita un correo, así que cada usuario se mapea a un
// correo sintético interno: "karen" -> "karen@alabanza.local".
// Ese correo nunca se muestra ni se usa para enviar nada.

export const USERNAME_DOMAIN = 'alabanza.local'

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function isValidUsername(value) {
  const v = normalizeUsername(value)
  return (
    v.length >= 3 &&
    v.length <= 30 &&
    /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(v)
  )
}

// Correo sintético a partir del usuario. Se usa al crear cuentas.
export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`
}

// Para iniciar sesión: si el valor ya es un correo (contiene "@") se usa tal
// cual; si no, se trata como usuario y se le añade el dominio sintético.
// Esto mantiene compatible al administrador creado antes con un correo real.
export function loginToEmail(value) {
  const v = String(value ?? '').trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`
}
