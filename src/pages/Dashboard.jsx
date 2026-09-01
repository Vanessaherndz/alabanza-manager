import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './Dashboard.module.css'

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function saludo(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

function fechaLarga(iso) {
  const txt = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function hora(iso) {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h < 12 ? 'AM' : 'PM'
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

const ESTADO = {
  confirmado: { txt: 'Confirmada', cls: styles.stConfirm },
  invitado: { txt: 'Pendiente', cls: styles.stPending },
  rechazado: { txt: 'Rechazada', cls: styles.stReject },
}

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

function Calendario({ churchId }) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [dias, setDias] = useState(new Set())

  useEffect(() => {
    if (!churchId) return
    let active = true
    const desde = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const hasta = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)

    supabase
      .from('events')
      .select('starts_at')
      .eq('church_id', churchId)
      .gte('starts_at', desde.toISOString())
      .lt('starts_at', hasta.toISOString())
      .then(({ data }) => {
        if (!active) return
        setDias(new Set((data ?? []).map((e) => new Date(e.starts_at).getDate())))
      })
    return () => {
      active = false
    }
  }, [churchId, cursor])

  const hoy = new Date()
  const esMesActual =
    hoy.getFullYear() === cursor.getFullYear() &&
    hoy.getMonth() === cursor.getMonth()

  const celdas = useMemo(() => {
    const totalDias = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate()
    const primerDow = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7
    const arr = Array(primerDow).fill(null)
    for (let d = 1; d <= totalDias; d++) arr.push(d)
    return arr
  }, [cursor])

  const titulo = new Intl.DateTimeFormat('es', {
    month: 'long',
    year: 'numeric',
  }).format(cursor)

  function mover(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  return (
    <section className="card">
      <div className={styles.calHead}>
        <span className={styles.calTitle}>{titulo}</span>
        <div className={styles.calNav}>
          <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente">
            ›
          </button>
        </div>
      </div>
      <div className={styles.calGrid}>
        {DOW.map((d) => (
          <span key={d} className={styles.calDow}>
            {d}
          </span>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const hoyCel = esMesActual && d === hoy.getDate()
          return (
            <span
              key={d}
              className={`${styles.calDay} ${hoyCel ? styles.calToday : ''}`}
            >
              {d}
              {dias.has(d) && <span className={styles.calDot} />}
            </span>
          )
        })}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { loading, memberships, activeChurchId, refresh } = useChurch()
  const navigate = useNavigate()

  const [next, setNext] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [equipo, setEquipo] = useState([])
  const [stats, setStats] = useState({ servicios: 0, ensayos: 0, canciones: 0, miembros: 0 })

  useEffect(() => {
    if (!activeChurchId) return
    let active = true

    async function load() {
      const nowIso = new Date().toISOString()

      const { data: ev } = await supabase
        .from('events')
        .select('id, title, starts_at, location')
        .eq('church_id', activeChurchId)
        .eq('type', 'servicio')
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!active) return
      setNext(ev ?? null)

      if (ev) {
        const [{ data: songs }, { data: asig }] = await Promise.all([
          supabase
            .from('event_songs')
            .select('position, song_key, song:songs (title, song_key, bpm)')
            .eq('event_id', ev.id)
            .order('position', { ascending: true }),
          supabase
            .from('event_assignments')
            .select('role, status, profile:profiles (full_name, username)')
            .eq('event_id', ev.id)
            .order('created_at', { ascending: true }),
        ])
        if (!active) return
        setSetlist(songs ?? [])
        setEquipo(asig ?? [])
      } else {
        setSetlist([])
        setEquipo([])
      }

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

    load()
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

  const nombre = profile?.full_name?.split(/\s+/)[0] || profile?.username || ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>
            {saludo()}, {nombre} <span aria-hidden>👋</span>
          </h1>
          <p className="muted">Todo listo para tu próximo servicio.</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/servicios')}
        >
          + Crear servicio
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.colMain}>
          <div className={styles.nextService}>
            <span className={styles.circle} aria-hidden />
            <span className={styles.nsLabel}>Próximo servicio</span>
            {next ? (
              <>
                <h2>{next.title}</h2>
                <p className={styles.nsMeta}>
                  {fechaLarga(next.starts_at)} · {hora(next.starts_at)} ·{' '}
                  {setlist.length}{' '}
                  {setlist.length === 1 ? 'canción' : 'canciones'}
                  {next.location ? ` · ${next.location}` : ''}
                </p>
                <Link to="/servicios" className={styles.nsLink}>
                  Ver servicio →
                </Link>
              </>
            ) : (
              <>
                <h2>Sin servicios próximos</h2>
                <p className={styles.nsEmpty}>
                  Crea un servicio para empezar a organizar el setlist y el equipo.
                </p>
                <Link to="/servicios" className={styles.nsLink}>
                  Crear servicio →
                </Link>
              </>
            )}
          </div>

          <section className="card">
            <div className={styles.cardHead}>
              <h3>Setlist del servicio</h3>
              <Link to="/servicios">Ver completo →</Link>
            </div>
            {setlist.length === 0 ? (
              <p className="muted">Sin canciones en el setlist.</p>
            ) : (
              setlist.map((s, i) => (
                <div className={styles.songRow} key={i}>
                  <span className={styles.songPos}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.songTitle}>
                    {s.song?.title ?? '—'}
                  </span>
                  <span className={styles.songKey}>
                    {s.song_key || s.song?.song_key || '—'}
                  </span>
                  <span className={styles.songBpm}>
                    {s.song?.bpm ? `${s.song.bpm}` : '—'}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        <div className={styles.colSide}>
          <Calendario churchId={activeChurchId} />

          <section className="card">
            <div className={styles.cardHead}>
              <h3>Equipo asignado</h3>
              <Link to="/miembros">Gestionar</Link>
            </div>
            {equipo.length === 0 ? (
              <p className="muted">Sin asignaciones.</p>
            ) : (
              equipo.map((a, i) => {
                const est = ESTADO[a.status] ?? ESTADO.invitado
                const nom = a.profile?.full_name || a.profile?.username || '—'
                return (
                  <div className={styles.teamRow} key={i}>
                    <span className={styles.avatar}>{iniciales(nom)}</span>
                    <span>
                      <span className={styles.teamName}>{nom}</span>
                      {a.role && (
                        <span className={styles.teamRole}>{a.role}</span>
                      )}
                    </span>
                    <span className={`${styles.teamStatus} ${est.cls}`}>
                      {est.txt}
                    </span>
                  </div>
                )
              })
            )}
          </section>
        </div>
      </div>

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
