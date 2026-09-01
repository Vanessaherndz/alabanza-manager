import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './Dashboard.module.css'

function CreateChurchCard({ onCreated }) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.rpc('create_church', {
      _name: name,
      _city: city || null,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setCity('')
    onCreated()
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

export default function Dashboard() {
  const { loading, memberships, activeChurch, role, activeChurchId, refresh } =
    useChurch()
  const [stats, setStats] = useState({ servicios: 0, ensayos: 0, canciones: 0, miembros: 0 })

  useEffect(() => {
    if (!activeChurchId) return
    let active = true

    async function loadStats() {
      const nowIso = new Date().toISOString()
      const [servicios, ensayos, canciones, miembros] = await Promise.all([
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('church_id', activeChurchId)
          .eq('type', 'servicio')
          .gte('starts_at', nowIso),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('church_id', activeChurchId)
          .eq('type', 'ensayo')
          .gte('starts_at', nowIso),
        supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .eq('church_id', activeChurchId),
        supabase
          .from('church_members')
          .select('profile_id', { count: 'exact', head: true })
          .eq('church_id', activeChurchId),
      ])
      if (!active) return
      setStats({
        servicios: servicios.count ?? 0,
        ensayos: ensayos.count ?? 0,
        canciones: canciones.count ?? 0,
        miembros: miembros.count ?? 0,
      })
    }

    loadStats()
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

  return (
    <div className={styles.page}>
      <header>
        <h1>{activeChurch?.name}</h1>
        <p className="muted">
          {activeChurch?.city ? `${activeChurch.city} · ` : ''}
          Tu rol: <strong>{role === 'admin' ? 'Administrador' : 'Usuario'}</strong>
        </p>
      </header>

      <div className={styles.stats}>
        <div className="card">
          <span className={styles.statNum}>{stats.servicios}</span>
          <span className="muted">Servicios próximos</span>
        </div>
        <div className="card">
          <span className={styles.statNum}>{stats.ensayos}</span>
          <span className="muted">Ensayos próximos</span>
        </div>
        <div className="card">
          <span className={styles.statNum}>{stats.canciones}</span>
          <span className="muted">Canciones</span>
        </div>
        <div className="card">
          <span className={styles.statNum}>{stats.miembros}</span>
          <span className="muted">Miembros</span>
        </div>
      </div>

      <CreateChurchCard onCreated={refresh} />
    </div>
  )
}
