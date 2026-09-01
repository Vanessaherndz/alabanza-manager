import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import { SERVICE_SECTIONS, SIN_SECCION } from '../lib/serviceSections.js'
import { INSTRUMENTS, CANTANTE_ROLE } from '../lib/serviceRoles.js'
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

function diasRestantes(iso) {
  const ms = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  const d = Math.round(ms / 86400000)
  if (d <= 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  return `En ${d} días`
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
  const [dias, setDias] = useState(new Map())

  useEffect(() => {
    if (!churchId) return
    let active = true
    const desde = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const hasta = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)

    supabase
      .from('events')
      .select('title, type, starts_at')
      .eq('church_id', churchId)
      .gte('starts_at', desde.toISOString())
      .lt('starts_at', hasta.toISOString())
      .then(({ data }) => {
        if (!active) return
        const m = new Map()
        for (const e of data ?? []) {
          const d = new Date(e.starts_at).getDate()
          if (!m.has(d)) m.set(d, [])
          m.get(d).push(e.title)
        }
        setDias(m)
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
    const primerDow =
      (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7
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
          const titulos = dias.get(d)
          return (
            <span
              key={d}
              className={`${styles.calDay} ${hoyCel ? styles.calToday : ''}`}
              title={titulos ? titulos.join(' · ') : undefined}
            >
              {d}
              {titulos && <span className={styles.calDot} />}
            </span>
          )
        })}
      </div>
      <p className={styles.calLegend}>
        <span className={styles.calDotInline} /> día con evento
      </p>
    </section>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { loading, memberships, activeChurch, activeChurchId, refresh } = useChurch()
  const navigate = useNavigate()

  const [next, setNext] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [equipo, setEquipo] = useState([])
  const [stats, setStats] = useState({
    servicios: 0,
    ensayos: 0,
    canciones: 0,
    miembros: 0,
  })

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
            .select('position, song_key, section, song:songs (title, song_key, bpm)')
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

  const grupos = useMemo(() => {
    return [...SERVICE_SECTIONS, SIN_SECCION]
      .map((name) => ({
        name,
        items: setlist.filter((s) => (s.section || SIN_SECCION) === name),
      }))
      .filter((g) => g.items.length > 0)
  }, [setlist])

  const equipoGrupos = useMemo(() => {
    const orden = [...INSTRUMENTS, CANTANTE_ROLE]
    const grupos = [
      { name: 'Instrumentos', items: [] },
      { name: 'Cantantes', items: [] },
      { name: 'Otros', items: [] },
    ]
    for (const a of equipo) {
      if (a.role === CANTANTE_ROLE) grupos[1].items.push(a)
      else if (INSTRUMENTS.includes(a.role)) grupos[0].items.push(a)
      else grupos[2].items.push(a)
    }
    grupos[0].items.sort(
      (x, y) => orden.indexOf(x.role) - orden.indexOf(y.role),
    )
    return grupos.filter((g) => g.items.length > 0)
  }, [equipo])

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
  const confirmados = equipo.filter((a) => a.status === 'confirmado').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>
            {saludo()}, {nombre} <span aria-hidden>👋</span>
          </h1>
          <p className="muted">
            {activeChurch?.name ? `${activeChurch.name} · ` : ''}
            Todo listo para tu próximo servicio.
          </p>
        </div>
        <button className="btn" onClick={() => navigate('/servicios/nuevo')}>
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
                <div className={styles.nsRow}>
                  <span className={styles.nsBadge}>
                    {diasRestantes(next.starts_at)}
                  </span>
                  <Link to={`/servicios/${next.id}`} className={styles.nsLink}>
                    Ver servicio →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>Sin servicios próximos</h2>
                <p className={styles.nsEmpty}>
                  Crea un servicio para organizar el setlist y el equipo.
                </p>
                <Link to="/servicios/nuevo" className={styles.nsLink}>
                  Crear servicio →
                </Link>
              </>
            )}
          </div>

          <section className="card">
            <div className={styles.cardHead}>
              <h3>Setlist del servicio</h3>
              {next && <Link to={`/servicios/${next.id}`}>Ver completo →</Link>}
            </div>
            {setlist.length === 0 ? (
              <p className="muted">Sin canciones en el setlist.</p>
            ) : (
              grupos.map((g) => (
                <div key={g.name}>
                  <p className={styles.groupLabel}>{g.name}</p>
                  {g.items.map((s, i) => (
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
                  ))}
                </div>
              ))
            )}
          </section>
        </div>

        <div className={styles.colSide}>
          <Calendario churchId={activeChurchId} />

          <section className="card">
            <div className={styles.cardHead}>
              <h3>
                Equipo asignado
                {equipo.length > 0 && (
                  <span className={styles.count}>
                    {' '}
                    {confirmados}/{equipo.length}
                  </span>
                )}
              </h3>
              {next && <Link to={`/servicios/${next.id}`}>Gestionar</Link>}
            </div>
            {equipo.length === 0 ? (
              <p className="muted">Sin asignaciones.</p>
            ) : (
              equipoGrupos.map((g) => (
                <div key={g.name}>
                  <p className={styles.groupLabel}>{g.name}</p>
                  {g.items.map((a, i) => {
                    const est = ESTADO[a.status] ?? ESTADO.invitado
                    const nom =
                      a.profile?.full_name || a.profile?.username || '—'
                    return (
                      <div className={styles.teamRow} key={i}>
                        <span className={styles.avatar}>{iniciales(nom)}</span>
                        <span className={styles.teamMain}>
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
                  })}
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <div className={styles.stats}>
        <Link to="/servicios" className="card">
          <span className={styles.statNum}>{stats.servicios}</span>
          <span className="muted">Servicios próximos</span>
        </Link>
        <Link to="/ensayos" className="card">
          <span className={styles.statNum}>{stats.ensayos}</span>
          <span className="muted">Ensayos próximos</span>
        </Link>
        <Link to="/canciones" className="card">
          <span className={styles.statNum}>{stats.canciones}</span>
          <span className="muted">Canciones</span>
        </Link>
        <Link to="/miembros" className="card">
          <span className={styles.statNum}>{stats.miembros}</span>
          <span className="muted">Miembros</span>
        </Link>
      </div>

      <CreateChurchCard onCreated={refresh} />
    </div>
  )
}
