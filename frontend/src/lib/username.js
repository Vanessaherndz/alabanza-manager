// Alabanza Manager usa autenticación por "usuario + contraseña".
// Firebase Auth siempre necesita un correo, así que cada usuario se mapea a un
// correo sintético interno: "karen" -> "karen@alabanza-manager.com".
// Ese correo nunca se muestra ni se usa para enviar nada. Debe coincidir con
// USERNAME_DOMAIN en backend/.env.

export const USERNAME_DOMAIN = 'alabanza-manager.com'

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

export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`
}
