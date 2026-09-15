import { SIN_SECCION } from './serviceSections.js'

// Agrupa alabanzas o asignaciones por su "section" (nombre libre), en el
// orden en que aparecen. `seedOrder` permite arrancar con un orden ya
// conocido (p.ej. el de las alabanzas) para que el equipo respete ese orden.
export function groupBySection(items, seedOrder = []) {
  const names = [...seedOrder]
  for (const item of items) {
    const name = item.section || SIN_SECCION
    if (!names.includes(name)) names.push(name)
  }
  return names
    .map((name) => ({
      name,
      items: items.filter((it) => (it.section || SIN_SECCION) === name),
    }))
    .filter((g) => g.items.length > 0)
}
