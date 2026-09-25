import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Church, Mic, Music, Settings, TrendingUp, UserCheck, Users } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import CreateChurchForm from '../components/CreateChurchForm.jsx'
import styles from './Dashboard.module.css'

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** El próximo servicio destacado, con un adelanto de su programa. */
function NextService({ service, preview }) {
  return (
    <Link to={`/servicios/${service.id}`} className={styles.next}>
      <span className={styles.nextLabel}>Siguiente</span>
      <span className={styles.nextTitle}>{service.title}</span>
      <span className={styles.nextDate}>
        {formatFecha(service.startsAt)}
        {service.location && ` · ${service.location}`}
      </span>

      <span className={styles.previewRow}>
        <Music size={14} aria-hidden />
        {preview.songs.length === 0 ? (
          <span className="muted">Sin alabanzas aún</span>
        ) : (
          <span className={styles.previewText}>
            {preview.songs.join(' · ')}
            {preview.moreSongs > 0 && (
              <span className={styles.previewMore}> +{preview.moreSongs} más</span>
            )}
          </span>
        )}
      </span>

      <span className={styles.previewRow}>
        <Mic size={14} aria-hidden />
        <span className={styles.previewText}>
          {preview.vocalLeads.length > 0 ? preview.vocalLeads.join(', ') : 'Sin voz principal'}
        </span>
      </span>

      {preview.team > 0 && (
        <span className={styles.previewRow}>
          <UserCheck size={14} aria-hidden />
          <span className={styles.previewText}>
            {preview.confirmed} de {preview.team} confirmados
          </span>
        </span>
      )}

      <span className={styles.nextCta}>Ver programa completo →</span>
    </Link>
  )
}

const SECTIONS = [
  { to: '/servicios', icon: Church, title: 'Servicios', label: 'servicios', statKey: 'servicios' },
  { to: '/canciones', icon: Music, title: 'Canciones', label: 'canciones', statKey: 'canciones' },
  { to: '/miembros', icon: Users, title: 'Miembros', label: 'miembros', statKey: 'miembros' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const { loading, memberships, activeChurchId, activeChurch, isAdmin, refresh } = useChurch()

  const [stats, setStats] = useState({ servicios: 0, canciones: 0, miembros: 0 })
  const [upcoming, setUpcoming] = useState([])
  const [nextPreview, setNextPreview] = useState(null)
  const [popularSongs, setPopularSongs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeChurchId) return
    let active = true
    api
      .get(`/churches/${activeChurchId}/dashboard`)
      .then((data) => {
        if (!active || !data) return
        setStats(data.stats ?? { servicios: 0, canciones: 0, miembros: 0 })
        setUpcoming(data.upcoming ?? [])
        setNextPreview(data.nextPreview ?? null)
        setPopularSongs(data.popularSongs ?? [])
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [activeChurchId])

  if (loading) return <p>Cargando…</p>

  if (memberships.length === 0) {
    return (
      <div className={styles.page}>
        <h1>Bienvenido</h1>
        <CreateChurchForm onCreated={refresh} />
      </div>
    )
  }

  const nombre = profile?.fullName?.split(/\s+/)[0] || profile?.username || ''

  return (
    <div className={styles.page}>
      <div className={`card ${styles.welcome}`}>
        <h1>Bienvenidos{activeChurch?.name ? ` a ${activeChurch.name}` : ''}</h1>
        <p>{nombre ? `Hola, ${nombre}. ` : ''}Dios te bendiga 🙏</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className={styles.sections}>
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.to} to={s.to} className={`card ${styles.sectionCard}`}>
              <span className={styles.sectionIcon} aria-hidden>
                <Icon size={22} />
              </span>
              <span className={styles.sectionTitle}>{s.title}</span>
              <span className={styles.sectionNum}>{stats[s.statKey]}</span>
              <span className={styles.sectionLink}>Ver {s.label} →</span>
            </Link>
          )
        })}

        {isAdmin && (
          <Link to="/configuracion" className={`card ${styles.sectionCard}`}>
            <span className={styles.sectionIcon} aria-hidden>
              <Settings size={22} />
            </span>
            <span className={styles.sectionTitle}>Configuración</span>
            <span className={styles.sectionLink}>Personalizar iglesia →</span>
          </Link>
        )}
      </div>

      <div className={styles.lists}>
        <section className={`card ${styles.listCard}`}>
          <h2 className={styles.listTitle}>
            <CalendarDays size={18} aria-hidden />
            Próximos servicios
          </h2>
          {upcoming.length === 0 ? (
            <p className="muted">No hay servicios programados.</p>
          ) : (
            <>
              {nextPreview && <NextService service={upcoming[0]} preview={nextPreview} />}
            <ul className={styles.listItems}>
              {upcoming.slice(nextPreview ? 1 : 0).map((s) => (
                <li key={s.id}>
                  <Link to={`/servicios/${s.id}`} className={styles.listRow}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{s.title}</span>
                      {s.location && <span className={styles.rowSub}>{s.location}</span>}
                    </span>
                    <span className={styles.rowMeta}>{formatFecha(s.startsAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            </>
          )}
          <Link to="/servicios" className={styles.sectionLink}>
            Ver todos →
          </Link>
        </section>

        <section className={`card ${styles.listCard}`}>
          <h2 className={styles.listTitle}>
            <TrendingUp size={18} aria-hidden />
            Canciones populares
          </h2>
          {popularSongs.length === 0 ? (
            <p className="muted">Aún no hay canciones usadas en servicios.</p>
          ) : (
            <ol className={styles.listItems}>
              {popularSongs.map((song, i) => (
                <li key={song.id} className={styles.listRow}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{song.title}</span>
                    {song.songKey && <span className={styles.rowSub}>Tono: {song.songKey}</span>}
                  </span>
                  <span className={styles.rowMeta}>
                    {song.uses} {song.uses === 1 ? 'servicio' : 'servicios'}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Link to="/canciones" className={styles.sectionLink}>
            Ver canciones →
          </Link>
        </section>
      </div>
    </div>
  )
}
