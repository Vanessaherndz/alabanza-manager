import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Pencil, Trash2 } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import ServiceSummaryTable from './ServiceSummaryTable.jsx'
import BackToMenu from './BackToMenu.jsx'
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
    try {
      const data = await api.get(`/churches/${activeChurchId}/events`)
      setEvents(data ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este servicio?')) return
    try {
      await api.delete(`/events/${id}`)
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
      <div className={styles.header}>
        <h1>Servicios</h1>
        <div className={styles.headerActions}>
          <BackToMenu />
          {isAdmin && (
            <Link className="btn" to="/servicios/nuevo">
              + Nuevo servicio
            </Link>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : events.length === 0 ? (
        <p className="muted">No hay servicios registrados.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((ev) => (
            <li key={ev.id} className="card">
              <div className={styles.itemHead}>
                <div>
                  <Link to={`/servicios/${ev.id}`}>
                    <strong>{ev.title}</strong>
                  </Link>
                  <div className="muted">{formatDateTime(ev.startsAt)}</div>
                  {ev.location && (
                    <div className="muted">
                      <MapPin size={13} className={styles.lineIcon} aria-hidden /> {ev.location}
                    </div>
                  )}
                  {ev.notes && <p>{ev.notes}</p>}
                </div>
                <div className={styles.itemActions}>
                  <Link className="btn btn-secondary" to={`/servicios/${ev.id}`}>
                    {isAdmin ? (
                      <>
                        <Pencil size={14} /> Editar
                      </>
                    ) : (
                      'Ver'
                    )}
                  </Link>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDelete(ev.id)}
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.preview}>
                <ServiceSummaryTable songs={ev.songs ?? []} team={ev.assignments ?? []} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
