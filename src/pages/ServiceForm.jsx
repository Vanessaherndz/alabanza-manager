import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import { INSTRUMENTS, CANTANTE_ROLE } from '../lib/serviceRoles.js'
import styles from './ServiceForm.module.css'

// Júbilo y Adoración como columnas principales; luego Bienvenida y Despedida.
const SONG_ORDER = ['Júbilo', 'Adoración', 'Bienvenida', 'Despedida']

function nombreDe(p) {
  return p?.full_name || p?.username || '—'
}

/** Selector de personas con "chips" (permite varias). */
function MemberPicker({ members, selected, onChange, placeholder }) {
  const disponibles = members.filter((m) => !selected.includes(m.id))
  return (
    <div>
      <div className={styles.picker}>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value])
          }}
        >
          <option value="">{placeholder}</option>
          {disponibles.map((m) => (
            <option key={m.id} value={m.id}>
              {nombreDe(m)}
            </option>
          ))}
        </select>
      </div>
      {selected.length > 0 && (
        <div className={styles.chips}>
          {selected.map((id) => {
            const m = members.find((x) => x.id === id)
            return (
              <span className={styles.chip} key={id}>
                {nombreDe(m)}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                  aria-label="Quitar"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Selector de canciones con "chips". */
function SongPicker({ repertoire, taken, selected, onChange }) {
  const disponibles = repertoire.filter(
    (s) => !taken.includes(s.id) || selected.includes(s.id),
  )
  return (
    <div>
      <div className={styles.picker}>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value])
          }}
        >
          <option value="">Agregar canción…</option>
          {disponibles
            .filter((s) => !selected.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.artist ? ` — ${s.artist}` : ''}
              </option>
            ))}
        </select>
      </div>
      {selected.length > 0 && (
        <div className={styles.chips}>
          {selected.map((id) => {
            const s = repertoire.find((x) => x.id === id)
            return (
              <span className={styles.chip} key={id}>
                {s?.title ?? '—'}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                  aria-label="Quitar"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ServiceForm() {
  const { user } = useAuth()
  const { activeChurchId, isAdmin } = useChurch()
  const navigate = useNavigate()

  const [datos, setDatos] = useState({
    title: '',
    starts_at: '',
    location: '',
    notes: '',
  })
  const [songs, setSongs] = useState(() =>
    Object.fromEntries(SONG_ORDER.map((s) => [s, []])),
  )
  const [inst, setInst] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i, []])),
  )
  const [cantantes, setCantantes] = useState([])

  const [repertoire, setRepertoire] = useState([])
  const [members, setMembers] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!activeChurchId) return
    supabase
      .from('songs')
      .select('id, title, artist, song_key, bpm')
      .eq('church_id', activeChurchId)
      .order('title', { ascending: true })
      .then(({ data }) => setRepertoire(data ?? []))
    supabase
      .from('church_members')
      .select('profile:profiles (id, username, full_name)')
      .eq('church_id', activeChurchId)
      .then(({ data }) =>
        setMembers((data ?? []).map((r) => r.profile).filter(Boolean)),
      )
  }, [activeChurchId])

  const takenSongs = useMemo(
    () => Object.values(songs).flat(),
    [songs],
  )

  const weekday = datos.starts_at
    ? new Intl.DateTimeFormat('es', { weekday: 'long' }).format(
        new Date(datos.starts_at),
      )
    : ''

  if (!activeChurchId) {
    return <p className="muted">Selecciona o crea una iglesia primero.</p>
  }
  if (!isAdmin) {
    return <p className="muted">Solo un administrador puede crear servicios.</p>
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .insert({
        church_id: activeChurchId,
        type: 'servicio',
        title: datos.title,
        starts_at: new Date(datos.starts_at).toISOString(),
        location: datos.location || null,
        notes: datos.notes || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (evErr) {
      setSaving(false)
      setError(evErr.message)
      return
    }

    // Canciones por momento
    const songRows = []
    let pos = 1
    for (const section of SONG_ORDER) {
      for (const songId of songs[section]) {
        songRows.push({
          event_id: ev.id,
          song_id: songId,
          section,
          position: pos++,
        })
      }
    }
    if (songRows.length) {
      const { error: sErr } = await supabase.from('event_songs').insert(songRows)
      if (sErr) {
        setSaving(false)
        setError(`Servicio creado, pero falló el setlist: ${sErr.message}`)
        navigate(`/servicios/${ev.id}`)
        return
      }
    }

    // Equipo: instrumentos + cantantes
    const asgRows = []
    for (const i of INSTRUMENTS) {
      for (const pid of inst[i]) {
        asgRows.push({ event_id: ev.id, profile_id: pid, role: i, status: 'invitado' })
      }
    }
    for (const pid of cantantes) {
      asgRows.push({
        event_id: ev.id,
        profile_id: pid,
        role: CANTANTE_ROLE,
        status: 'invitado',
      })
    }
    if (asgRows.length) {
      const { error: aErr } = await supabase
        .from('event_assignments')
        .insert(asgRows)
      if (aErr) {
        setSaving(false)
        setError(`Servicio creado, pero falló el equipo: ${aErr.message}`)
        navigate(`/servicios/${ev.id}`)
        return
      }
    }

    setSaving(false)
    navigate(`/servicios/${ev.id}`)
  }

  return (
    <form className={styles.page} onSubmit={handleSubmit}>
      <Link to="/servicios" className={styles.back}>
        ← Servicios
      </Link>
      <h1>Nuevo servicio</h1>

      {/* Datos */}
      <section className="card">
        <h3>Datos del servicio</h3>
        <div className={styles.grid}>
          <div className="field">
            <label>Título</label>
            <input
              value={datos.title}
              onChange={(e) => setDatos({ ...datos, title: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Fecha y hora {weekday && <span className={styles.weekday}>· {weekday}</span>}</label>
            <input
              type="datetime-local"
              value={datos.starts_at}
              onChange={(e) => setDatos({ ...datos, starts_at: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Lugar</label>
            <input
              value={datos.location}
              onChange={(e) => setDatos({ ...datos, location: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Notas</label>
          <textarea
            rows={2}
            value={datos.notes}
            onChange={(e) => setDatos({ ...datos, notes: e.target.value })}
          />
        </div>
      </section>

      {/* Canciones */}
      <section className="card">
        <h3>Canciones</h3>
        {repertoire.length === 0 && (
          <p className="muted">
            No hay canciones en el repertorio.{' '}
            <Link to="/canciones">Agregar canciones</Link>
          </p>
        )}
        <div className={styles.songCols}>
          {SONG_ORDER.map((section) => (
            <div className={styles.block} key={section}>
              <p className={styles.blockTitle}>
                {section === 'Júbilo'
                  ? 'Canciones de Júbilo'
                  : section === 'Adoración'
                    ? 'Adoración'
                    : section}
              </p>
              <SongPicker
                repertoire={repertoire}
                taken={takenSongs}
                selected={songs[section]}
                onChange={(next) => setSongs({ ...songs, [section]: next })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Equipo */}
      <section className="card">
        <h3>Equipo</h3>

        <p className={styles.blockTitle}>Instrumentos</p>
        {INSTRUMENTS.map((i) => (
          <div className={styles.instRow} key={i}>
            <span className={styles.instName}>{i}</span>
            <MemberPicker
              members={members}
              selected={inst[i]}
              onChange={(next) => setInst({ ...inst, [i]: next })}
              placeholder="Agregar músico…"
            />
          </div>
        ))}

        <p className={styles.blockTitle} style={{ marginTop: '1rem' }}>
          Cantantes
        </p>
        <MemberPicker
          members={members}
          selected={cantantes}
          onChange={setCantantes}
          placeholder="Agregar cantante…"
        />

        {members.length === 0 && (
          <p className="muted">
            No hay miembros en la iglesia.{' '}
            <Link to="/miembros">Agregar miembros</Link>
          </p>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Creando…' : 'Crear servicio'}
        </button>
      </div>
    </form>
  )
}
