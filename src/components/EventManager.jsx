import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './EventManager.module.css'

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function EventManager() {
  const { activeChurchId, isAdmin } = useChurch()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, notes')
      .eq('church_id', activeChurchId)
      .eq('type', 'servicio')
      .order('starts_at', { ascending: true })
    if (error) setError(error.message)
    else setEvents(data ?? [])
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este servicio?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (!activeChurchId) {
    return <p className="muted">Selecciona o crea una iglesia primero.</p>
  }

  return (
    <div className={styles.page}>
      <h1>Servicios</h1>

      {isAdmin && (
        <div>
          <Link className="btn" to="/servicios/nuevo">
            + Nuevo servicio
          </Link>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : events.length === 0 ? (
        <p className="muted">No hay servicios registrados.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((ev) => (
            <li key={ev.id} className="card">
              <div>
                <Link to={`/servicios/${ev.id}`}>
                  <strong>{ev.title}</strong>
                </Link>
                <div className="muted">{formatDateTime(ev.starts_at)}</div>
                {ev.location && <div className="muted">📍 {ev.location}</div>}
                {ev.notes && <p>{ev.notes}</p>}
              </div>
              <div className={styles.itemActions}>
                <Link className="btn btn-secondary" to={`/servicios/${ev.id}`}>
                  Abrir
                </Link>
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
