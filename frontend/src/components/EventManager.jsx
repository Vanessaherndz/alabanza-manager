import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import ServiceSummaryTable from './ServiceSummaryTable.jsx'
import BackToMenu from './BackToMenu.jsx'
import styles from './EventManager.module.css'

function dateParts(iso) {
  const d = new Date(iso)
  return {
    day: d.getDate(),
    month: d.toLocaleString('es', { month: 'short' }).replace('.', ''),
    weekday: d.toLocaleString('es', { weekday: 'long' }),
    time: d.toLocaleString('es', { hour: '2-digit', minute: '2-digit' }),
  }
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
        <h1>Servicios</h1>
        <p className="muted">Selecciona o crea una iglesia primero.</p>
      </div>
    )
  }

  const newServiceLink = isAdmin && (
    <Link className="btn" to="/servicios/nuevo">
      <Plus size={16} aria-hidden />
      Nuevo servicio
    </Link>
  )

  return (
    <div className={styles.page}>
      <BackToMenu />

      <header className={styles.header}>
        <div>
          <h1>Servicios</h1>
          <p className={styles.subtitle}>
            {loading
              ? 'Cargando servicios…'
              : `${events.length} ${events.length === 1 ? 'servicio' : 'servicios'}`}
          </p>
        </div>
        {(loading || events.length > 0) && newServiceLink}
      </header>

      {error && <p className="error">{error}</p>}

      {loading ? null : events.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          <span className={styles.emptyIcon} aria-hidden>
            <CalendarPlus size={26} />
          </span>
          <h2>Aún no hay servicios</h2>
          <p className="muted">
            {isAdmin
              ? 'Crea el primero para organizar alabanzas y equipo.'
              : 'Cuando se programe un servicio aparecerá aquí.'}
          </p>
          {newServiceLink}
        </div>
      ) : (
        <ul className={styles.list}>
          {events.map((ev) => {
            const date = dateParts(ev.startsAt)
            const isPast = new Date(ev.startsAt) < new Date()
            return (
              <li key={ev.id} className={`card ${styles.item} ${isPast ? styles.past : ''}`}>
                <div className={styles.itemHead}>
                  <div className={styles.dateBadge} aria-hidden>
                    <span className={styles.dateMonth}>{date.month}</span>
                    <span className={styles.dateDay}>{date.day}</span>
                  </div>

                  <div className={styles.itemInfo}>
                    <div className={styles.titleRow}>
                      <Link to={`/servicios/${ev.id}`} className={styles.itemTitle}>
                        {ev.title}
                      </Link>
                      {isPast && <span className={styles.pastTag}>Realizado</span>}
                    </div>
                    <div className={styles.meta}>
                      <span>
                        <Clock size={14} aria-hidden />
                        <span className={styles.weekday}>{date.weekday}</span> · {date.time}
                      </span>
                      {ev.location && (
                        <span>
                          <MapPin size={14} aria-hidden />
                          {ev.location}
                        </span>
                      )}
                    </div>
                    {ev.notes && <p className={styles.notes}>{ev.notes}</p>}
                  </div>

                  <div className={styles.itemActions}>
                    <Link
                      className={`btn btn-secondary ${isAdmin ? styles.editBtn : ''}`}
                      to={`/servicios/${ev.id}`}
                      aria-label={isAdmin ? `Editar ${ev.title}` : undefined}
                    >
                      {isAdmin && <Pencil size={14} aria-hidden />}
                      <span className={isAdmin ? styles.actionLabel : undefined}>
                        {isAdmin ? 'Editar' : 'Ver'}
                      </span>
                    </Link>
                    {isAdmin && (
                      <button
                        type="button"
                        className={styles.iconDanger}
                        onClick={() => handleDelete(ev.id)}
                        aria-label={`Eliminar ${ev.title}`}
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
            )
          })}
        </ul>
      )}
    </div>
  )
}
