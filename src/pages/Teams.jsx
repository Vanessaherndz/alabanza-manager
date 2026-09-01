import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
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
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, description')
      .eq('church_id', activeChurchId)
      .order('name', { ascending: true })
    if (error) setError(error.message)
    else setTeams(data ?? [])
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('teams').insert({
      church_id: activeChurchId,
      name: form.name,
      description: form.description || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', description: '' })
    load()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este equipo?')) return
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (!activeChurchId) {
    return <p className="muted">Selecciona o crea una iglesia primero.</p>
  }

  return (
    <div className={styles.page}>
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
