// Roles vocales de una sección: una Voz Principal y un Coro (2 o más).
export const VOICE_LEAD_ROLE = 'Voz Principal'
export const CHOIR_ROLE = 'Coro'

// Instrumentos (y roles vocales) disponibles para asignar a alguien:
// se usa tanto para el instrumento principal de un miembro como para el
// selector de músicos/roles de un servicio.
export const INSTRUMENTS = [
  'Piano',
  'Bajo',
  'Guitarra eléctrica',
  'Batería',
  'Violín',
  'Congas',
  VOICE_LEAD_ROLE,
  CHOIR_ROLE,
]

// Opciones de rol que se ofrecen al asignar a alguien manualmente (ServiceDetail).
export const ROLE_OPTIONS = [...INSTRUMENTS, 'Dirección', 'Otro']
