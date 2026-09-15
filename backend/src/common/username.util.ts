// Misma convencion que el frontend: cada usuario inicia sesion con un
// "usuario" y por dentro Firebase Auth guarda un correo sintetico
// usuario@<USERNAME_DOMAIN>. Mantener esto igual en ambos lados es lo que
// permite loguearse con solo usuario + contrasena.

export function normalizeUsername(value: string): string {
  return String(value ?? '').trim().toLowerCase()
}

export function isValidUsername(value: string): boolean {
  const v = normalizeUsername(value)
  return v.length >= 3 && v.length <= 30 && /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(v)
}

export function usernameToEmail(username: string, domain: string): string {
  return `${normalizeUsername(username)}@${domain}`
}
