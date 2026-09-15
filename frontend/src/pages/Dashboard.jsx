import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Church, Music, Users } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './Dashboard.module.css'

function CreateChurchCard({ onCreated }) {
  const { createChurch } = useChurch()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await createChurch({ name, city })
      setName('')
      setCity('')
      onCreated()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h3>Crear iglesia</h3>
      <p className="muted">Crea una iglesia y serás su administrador.</p>
      <div className="field">
        <label htmlFor="church-name">Nombre</label>
        <input
          id="church-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="church-city">Ciudad (opcional)</label>
        <input
          id="church-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Creando…' : 'Crear iglesia'}
      </button>
    </form>
  )
}

const SECTIONS = [
  { to: '/servicios', icon: Church, title: 'Servicios', label: 'servicios', statKey: 'servicios' },
  { to: '/canciones', icon: Music, title: 'Canciones', label: 'canciones', statKey: 'canciones' },
  { to: '/miembros', icon: Users, title: 'Miembros', label: 'miembros', statKey: 'miembros' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const { loading, memberships, activeChurchId, activeChurch, refresh } = useChurch()

  const [stats, setStats] = useState({ servicios: 0, canciones: 0, miembros: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeChurchId) return
    let active = true
    api
      .get(`/churches/${activeChurchId}/dashboard`)
      .then((data) => {
        if (!active || !data) return
        setStats(data.stats ?? { servicios: 0, canciones: 0, miembros: 0 })
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
        <CreateChurchCard onCreated={refresh} />
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
      </div>
    </div>
  )
}
