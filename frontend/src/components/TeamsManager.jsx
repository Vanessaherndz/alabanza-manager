import { useCallback, useEffect, useState } from 'react'
import { Check, Pencil, Trash2, UsersRound, X } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import MusicianPicker from './MusicianPicker.jsx'
import styles from './TeamsManager.module.css'

function nombreDe(p) {
  return p?.fullName || p?.username || '—'
}

/**
 * Grupos de músicos de la iglesia (p. ej. "Banda A"). Al crear un servicio
 * se puede elegir un grupo para llenar de una vez los músicos de una sección.
 * Cada cambio se guarda al momento.
 */
export default function TeamsManager({ churchId, members, instruments, isAdmin }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(null) // { id, name }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTeams((await api.get(`/churches/${churchId}/teams`)) ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [churchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (newName.trim().length < 2) return
    setError('')
    setCreating(true)
    try {
      const team = await api.post(`/churches/${churchId}/teams`, { name: newName.trim() })
      setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } catch (err) {
      setError(err.message)
    }
    setCreating(false)
  }

  // Actualiza en pantalla de inmediato y guarda; si falla, recarga.
  async function patchTeam(id, changes) {
    setError('')
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)))
    try {
      await api.patch(`/churches/${churchId}/teams/${id}`, changes)
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  async function handleRename(e) {
    e.preventDefault()
    if (!renaming || renaming.name.trim().length < 2) return
    await patchTeam(renaming.id, { name: renaming.name.trim() })
    setRenaming(null)
  }

  async function handleDelete(team) {
    if (!confirm(`¿Eliminar el grupo "${team.name}"? Los servicios ya creados no cambian.`)) return
    setError('')
    try {
      await api.delete(`/churches/${churchId}/teams/${team.id}`)
      setTeams((prev) => prev.filter((t) => t.id !== team.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2>Grupos de músicos</h2>
          <p className="muted">
            Agrupa a tus músicos para asignarlos de una vez al crear un servicio.
          </p>
        </div>
        {isAdmin && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del grupo (p. ej. Banda A)"
              aria-label="Nombre del nuevo grupo"
            />
            <button className="btn" type="submit" disabled={creating || newName.trim().length < 2}>
              {creating ? 'Creando…' : 'Crear grupo'}
            </button>
          </form>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : teams.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          <UsersRound size={24} aria-hidden />
          <span>Aún no hay grupos.{isAdmin && ' Crea el primero arriba.'}</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {teams.map((team) => (
            <article key={team.id} className={`card ${styles.team}`}>
              <header className={styles.teamHead}>
                {renaming?.id === team.id ? (
                  <form className={styles.renameForm} onSubmit={handleRename}>
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      aria-label="Nuevo nombre del grupo"
                    />
                    <button type="submit" className={styles.iconBtn} aria-label="Guardar nombre">
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setRenaming(null)}
                      aria-label="Cancelar"
                    >
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className={styles.teamTitle}>
                      <h3>{team.name}</h3>
                      <span className={styles.count}>
                        {team.members.length} {team.members.length === 1 ? 'músico' : 'músicos'}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className={styles.teamActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setRenaming({ id: team.id, name: team.name })}
                          aria-label={`Renombrar ${team.name}`}
                          title="Renombrar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.danger}`}
                          onClick={() => handleDelete(team)}
                          aria-label={`Eliminar ${team.name}`}
                          title="Eliminar grupo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </header>

              {isAdmin ? (
                <MusicianPicker
                  members={members}
                  selected={team.members.filter((tm) => members.some((m) => m.uid === tm.uid))}
                  onChange={(next) => patchTeam(team.id, { members: next })}
                  instruments={instruments}
                />
              ) : team.members.length === 0 ? (
                <p className="muted">Sin integrantes.</p>
              ) : (
                <ul className={styles.readList}>
                  {team.members.map((tm) => (
                    <li key={tm.uid}>
                      <span>{nombreDe(members.find((m) => m.uid === tm.uid))}</span>
                      <span className="muted">{tm.instrument || '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
