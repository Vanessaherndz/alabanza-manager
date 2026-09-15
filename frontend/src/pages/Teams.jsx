import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import BackToMenu from '../components/BackToMenu.jsx'
import styles from './List.module.css'

export default function Teams() {
  const { activeChurchId, isAdmin } = useChurch()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    try {
      const data = await api.get(`/churches/${activeChurchId}/teams`)
      setTeams(data ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post(`/churches/${activeChurchId}/teams`, {
        name: form.name,
        description: form.description || undefined,
      })
      setForm({ name: '', description: '' })
      load()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este equipo?')) return
    try {
      await api.delete(`/churches/${activeChurchId}/teams/${id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!activeChurchId) {
    return (
      <div className={styles.page}>
        <BackToMenu />
        <p className="muted">Selecciona o crea una iglesia primero.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <BackToMenu />
      <h1>Equipos de alabanza</h1>

      {isAdmin && (
        <form className="card" onSubmit={handleCreate}>
          <h3>Nuevo equipo</h3>
          <div className="field">
            <label>Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Descripción</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Crear equipo'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : teams.length === 0 ? (
        <p className="muted">No hay equipos todavía.</p>
      ) : (
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.id} className="card">
              <div>
                <strong>{team.name}</strong>
                {team.description && <div className="muted">{team.description}</div>}
              </div>
              {isAdmin && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(team.id)}
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
