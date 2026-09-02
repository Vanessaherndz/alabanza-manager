import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import { INSTRUMENTS, CANTANTE_ROLE } from '../lib/serviceRoles.js'
import { SERVICE_SECTIONS } from '../lib/serviceSections.js'
import styles from './ServiceForm.module.css'

function nombreDe(p) {
  return p?.full_name || p?.username || '—'
}

// Interpreta "YYYY-MM-DD" como mediodía en hora local, para no correr de día
// al convertir a Date/ISO por el huso horario.
function fechaInputALocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
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
  })
  // Estado por momento del servicio: canciones, cantantes y músicos de cada uno.
  const [sections, setSections] = useState(() =>
    Object.fromEntries(
      SERVICE_SECTIONS.map((s) => [
        s,
        {
          tono: '',
          songs: [],
          cantantes: [],
          inst: Object.fromEntries(INSTRUMENTS.map((i) => [i, []])),
        },
      ]),
    ),
  )

  function updateSection(section, patch) {
    setSections((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }))
  }

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
    () => Object.values(sections).flatMap((s) => s.songs),
    [sections],
  )

  const weekday = datos.starts_at
    ? new Intl.DateTimeFormat('es', { weekday: 'long' }).format(
        fechaInputALocal(datos.starts_at),
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
        starts_at: fechaInputALocal(datos.starts_at).toISOString(),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (evErr) {
      setSaving(false)
      setError(evErr.message)
      return
    }

    // Canciones y equipo, momento por momento
    const songRows = []
    const asgRows = []
    let pos = 1
    for (const section of SERVICE_SECTIONS) {
      const s = sections[section]

      for (const songId of s.songs) {
        songRows.push({
          event_id: ev.id,
          song_id: songId,
          section,
          song_key: s.tono.trim() || null,
          position: pos++,
        })
      }

      for (const pid of s.cantantes) {
        asgRows.push({
          event_id: ev.id,
          profile_id: pid,
          role: CANTANTE_ROLE,
          section,
          status: 'invitado',
        })
      }
      for (const i of INSTRUMENTS) {
        for (const pid of s.inst[i]) {
          asgRows.push({
            event_id: ev.id,
            profile_id: pid,
            role: i,
            section,
            status: 'invitado',
          })
        }
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
            <label>Fecha {weekday && <span className={styles.weekday}>· {weekday}</span>}</label>
            <input
              type="date"
              value={datos.starts_at}
              onChange={(e) => setDatos({ ...datos, starts_at: e.target.value })}
              required
            />
          </div>
        </div>
      </section>

      {(repertoire.length === 0 || members.length === 0) && (
        <section className="card">
          {repertoire.length === 0 && (
            <p className="muted">
              No hay canciones en el repertorio.{' '}
              <Link to="/canciones">Agregar canciones</Link>
            </p>
          )}
          {members.length === 0 && (
            <p className="muted">
              No hay miembros en la iglesia.{' '}
              <Link to="/miembros">Agregar miembros</Link>
            </p>
          )}
        </section>
      )}

      {/* Momentos del servicio: canciones + cantante + músicos de cada uno */}
      {SERVICE_SECTIONS.map((section, idx) => {
        const s = sections[section]
        return (
          <section className={`card ${styles.momento}`} key={section}>
            <div className={styles.momentoHead}>
              <span className={styles.momentoNum}>{idx + 1}</span>
              <h3>{section}</h3>
              <label className={styles.tono}>
                Tono
                <input
                  value={s.tono}
                  onChange={(e) => updateSection(section, { tono: e.target.value })}
                  placeholder="Ej: G"
                />
              </label>
            </div>

            <p className={styles.blockTitle}>Canciones</p>
            <SongPicker
              repertoire={repertoire}
              taken={takenSongs}
              selected={s.songs}
              onChange={(next) => updateSection(section, { songs: next })}
            />

            <p className={styles.blockTitle} style={{ marginTop: '1.1rem' }}>
              Cantante
            </p>
            <MemberPicker
              members={members}
              selected={s.cantantes}
              onChange={(next) => updateSection(section, { cantantes: next })}
              placeholder="Agregar cantante…"
            />

            <p className={styles.blockTitle} style={{ marginTop: '1.1rem' }}>
              Músicos
            </p>
            <div className={styles.instGrid}>
              {INSTRUMENTS.map((i) => (
                <div className={styles.instRow} key={i}>
                  <span className={styles.instName}>{i}</span>
                  <MemberPicker
                    members={members}
                    selected={s.inst[i]}
                    onChange={(next) =>
                      updateSection(section, { inst: { ...s.inst, [i]: next } })
                    }
                    placeholder="Agregar músico…"
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {error && <p className="error">{error}</p>}

      <div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Creando…' : 'Crear servicio'}
        </button>
      </div>
    </form>
  )
}
