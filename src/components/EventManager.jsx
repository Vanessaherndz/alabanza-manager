import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './EventManager.module.css'

const LABELS = {
  servicio: { title: 'Servicios', singular: 'servicio' },
  ensayo: { title: 'Ensayos', singular: 'ensayo' },
}

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EventManager({ type }) {
  const { user } = useAuth()
  const { activeChurchId, isAdmin } = useChurch()
  const labels = LABELS[type]

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', starts_at: '', location: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, notes')
      .eq('church_id', activeChurchId)
      .eq('type', type)
      .order('starts_at', { ascending: true })
    if (error) setError(error.message)
    else setEvents(data ?? [])
    setLoading(false)
  }, [activeChurchId, type])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('events').insert({
      church_id: activeChurchId,
      type,
      title: form.title,
      starts_at: new Date(form.starts_at).toISOString(),
      location: form.location || null,
      notes: form.notes || null,
      created_by: user.id,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ title: '', starts_at: '', location: '', notes: '' })
    load()
  }

  async function handleDelete(id) {
    if (!confirm(`¿Eliminar este ${labels.singular}?`)) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (!activeChurchId) {
    return <p className="muted">Selecciona o crea una iglesia primero.</p>
  }

  return (
    <div className={styles.page}>
      <h1>{labels.title}</h1>

      {isAdmin && (
        <form className="card" onSubmit={handleCreate}>
          <h3>Nuevo {labels.singular}</h3>
          <div className={styles.grid}>
            <div className="field">
              <label>Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Fecha y hora</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Lugar</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : `Agregar ${labels.singular}`}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : events.length === 0 ? (
        <p className="muted">No hay {labels.title.toLowerCase()} registrados.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((ev) => (
            <li key={ev.id} className="card">
              <div>
                {type === 'servicio' ? (
                  <Link to={`/servicios/${ev.id}`}>
                    <strong>{ev.title}</strong>
                  </Link>
                ) : (
                  <strong>{ev.title}</strong>
                )}
                <div className="muted">{formatDateTime(ev.starts_at)}</div>
                {ev.location && <div className="muted">📍 {ev.location}</div>}
                {ev.notes && <p>{ev.notes}</p>}
              </div>
              <div className={styles.itemActions}>
                {type === 'servicio' && (
                  <Link className="btn btn-secondary" to={`/servicios/${ev.id}`}>
                    Abrir
                  </Link>
                )}
                {isAdmin && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDelete(ev.id)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
