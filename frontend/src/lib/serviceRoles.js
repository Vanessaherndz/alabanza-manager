// Roles vocales de una sección: Voz Principal (una o varias) y Coro (2 o más).
// Son conceptos fijos de la app (se usan para agrupar la asignación), a
// diferencia de los instrumentos, que cada iglesia personaliza.
export const VOICE_LEAD_ROLE = 'Voz Principal'
export const CHOIR_ROLE = 'Coro'

// Opciones para el instrumento principal de un miembro o el instrumento de
// un músico en un servicio: los instrumentos de la iglesia + los roles
// vocales fijos.
export function buildInstrumentOptions(instruments = []) {
  return [...instruments, VOICE_LEAD_ROLE, CHOIR_ROLE]
}

// Opciones de rol al asignar a alguien manualmente (ServiceDetail): lo
// anterior más "Dirección" y "Otro".
export function buildRoleOptions(instruments = []) {
  return [...buildInstrumentOptions(instruments), 'Dirección', 'Otro']
}
