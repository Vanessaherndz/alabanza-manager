import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import { buildInstrumentOptions, VOICE_LEAD_ROLE, CHOIR_ROLE } from '../lib/serviceRoles.js'
import styles from './ServiceForm.module.css'

function nombreDe(p) {
  return p?.fullName || p?.username || '—'
}

// Interpreta "YYYY-MM-DD" como mediodía en hora local, para no correr de día
// al convertir a Date/ISO por el huso horario.
function fechaInputALocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function nuevaSeccion() {
  return {
    key: crypto.randomUUID(),
    name: '',
    tono: '',
    songIds: [],
    vocalLead: '',
    choir: [],
    musicians: [], // [{ uid, instrument }]
  }
}

/** Selector de personas con "chips" (permite varias). */
function MemberPicker({ members, selected, onChange, placeholder }) {
  const disponibles = members.filter((m) => !selected.includes(m.uid))
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
            <option key={m.uid} value={m.uid}>
              {nombreDe(m)}
            </option>
          ))}
        </select>
      </div>
      {selected.length > 0 && (
        <div className={styles.chips}>
          {selected.map((uid) => {
            const m = members.find((x) => x.uid === uid)
            return (
              <span className={styles.chip} key={uid}>
                {nombreDe(m)}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== uid))}
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

/** Selector de músicos: cada persona agregada trae un instrumento editable. */
function MusicianPicker({ members, selected, onChange, instruments }) {
  const disponibles = members.filter((m) => !selected.some((s) => s.uid === m.uid))
  return (
    <div>
      <div className={styles.picker}>
        <select
          value=""
          onChange={(e) => {
            const m = members.find((x) => x.uid === e.target.value)
            if (!m) return
            onChange([...selected, { uid: m.uid, instrument: m.instrument || instruments[0] }])
          }}
        >
          <option value="">Agregar músico…</option>
          {disponibles.map((m) => (
            <option key={m.uid} value={m.uid}>
              {nombreDe(m)}
              {m.instrument ? ` (${m.instrument})` : ''}
            </option>
          ))}
        </select>
      </div>
      {selected.length > 0 && (
        <div className={styles.musicianList}>
          {selected.map((row) => {
            const m = members.find((x) => x.uid === row.uid)
            return (
              <div className={styles.musicianRow} key={row.uid}>
                <span className={styles.musicianName}>{nombreDe(m)}</span>
                <select
                  value={row.instrument}
                  onChange={(e) =>
                    onChange(
                      selected.map((s) =>
                        s.uid === row.uid ? { ...s, instrument: e.target.value } : s,
                      ),
                    )
                  }
                >
                  {instruments.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.musicianRemove}
                  onClick={() => onChange(selected.filter((s) => s.uid !== row.uid))}
                  aria-label="Quitar"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Selector de canciones con "chips", con opción de crear una nueva. */
function SongPicker({ repertoire, taken, selected, onChange, onCreate }) {
  const [nuevo, setNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const disponibles = repertoire.filter(
    (s) => !taken.includes(s.id) || selected.includes(s.id),
  )

  async function handleCreate() {
    if (!nuevo.trim()) return
    setCreando(true)
    await onCreate(nuevo.trim())
    setNuevo('')
    setCreando(false)
  }

  return (
    <div>
      <div className={styles.picker}>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value])
          }}
        >
          <option value="">Elegir del repertorio…</option>
          {disponibles
            .filter((s) => !selected.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.songKey ? ` (${s.songKey})` : ''}
              </option>
            ))}
        </select>
      </div>
      <div className={styles.newSongRow}>
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="…o escribe el título de una alabanza nueva"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCreate}
          disabled={!nuevo.trim() || creando}
        >
          {creando ? 'Agregando…' : '+ Agregar'}
        </button>
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
  const { activeChurchId, activeChurch, isAdmin } = useChurch()
  const instruments = buildInstrumentOptions(activeChurch?.settings?.instruments)
  const navigate = useNavigate()

  const [datos, setDatos] = useState({ title: '', starts_at: '' })
  const [sections, setSections] = useState([nuevaSeccion()])

  function updateSection(key, patch) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  }

  function addSection() {
    setSections((prev) => [...prev, nuevaSeccion()])
  }

  function removeSection(key) {
    setSections((prev) => prev.filter((s) => s.key !== key))
  }

  const [repertoire, setRepertoire] = useState([])
  const [members, setMembers] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!activeChurchId) return
    api
      .get('/songs')
      .then((data) => setRepertoire(data ?? []))
      .catch((err) => setError(err.message))
    api
      .get(`/churches/${activeChurchId}/members`)
      .then((data) => setMembers(data ?? []))
      .catch((err) => setError(err.message))
  }, [activeChurchId])

  async function handleCreateSong(sectionKey, title) {
    setError('')
    try {
      const song = await api.post('/songs', { title })
      setRepertoire((prev) => [...prev, song].sort((a, b) => a.title.localeCompare(b.title)))
      setSections((prev) =>
        prev.map((s) =>
          s.key === sectionKey ? { ...s, songIds: [...s.songIds, song.id] } : s,
        ),
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const takenSongs = useMemo(
    () => sections.flatMap((s) => s.songIds),
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

    if (sections.some((s) => !s.name.trim())) {
      setError('Ponle un nombre a cada sección.')
      return
    }

    setSaving(true)

    const songs = []
    const assignments = []
    for (const s of sections) {
      for (const songId of s.songIds) {
        songs.push({ songId, section: s.name.trim(), songKey: s.tono.trim() || undefined })
      }
      if (s.vocalLead) {
        assignments.push({ uid: s.vocalLead, role: VOICE_LEAD_ROLE, section: s.name.trim() })
      }
      for (const uid of s.choir) {
        assignments.push({ uid, role: CHOIR_ROLE, section: s.name.trim() })
      }
      for (const musico of s.musicians) {
        assignments.push({ uid: musico.uid, role: musico.instrument, section: s.name.trim() })
      }
    }

    try {
      const ev = await api.post(`/churches/${activeChurchId}/events`, {
        title: datos.title,
        startsAt: fechaInputALocal(datos.starts_at).toISOString(),
        songs,
        assignments,
      })
      navigate(`/servicios/${ev.id}`)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <form className={styles.page} onSubmit={handleSubmit}>
      <Link to="/servicios" className={`btn btn-secondary ${styles.back}`}>
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

      {members.length === 0 && (
        <section className="card">
          <p className="muted">
            No hay miembros en la iglesia.{' '}
            <Link to="/miembros">Agregar miembros</Link>
          </p>
        </section>
      )}

      {/* Secciones del servicio, con nombre libre */}
      {sections.map((s, idx) => (
        <section className={`card ${styles.momento}`} key={s.key}>
          <div className={styles.momentoHead}>
            <span className={styles.momentoNum}>{idx + 1}</span>
            <input
              className={styles.sectionName}
              value={s.name}
              onChange={(e) => updateSection(s.key, { name: e.target.value })}
              placeholder="Nombre de la sección (ej: Adoración)"
              required
            />
            <label className={styles.tono}>
              Tono
              <input
                value={s.tono}
                onChange={(e) => updateSection(s.key, { tono: e.target.value })}
                placeholder="Ej: G"
              />
            </label>
            {sections.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => removeSection(s.key)}
              >
                Quitar sección
              </button>
            )}
          </div>

          <p className={styles.blockTitle}>Alabanzas</p>
          <SongPicker
            repertoire={repertoire}
            taken={takenSongs}
            selected={s.songIds}
            onChange={(next) => updateSection(s.key, { songIds: next })}
            onCreate={(title) => handleCreateSong(s.key, title)}
          />

          <p className={styles.blockTitle} style={{ marginTop: '1.1rem' }}>
            Voz principal
          </p>
          <div className={styles.picker}>
            <select
              value={s.vocalLead}
              onChange={(e) => updateSection(s.key, { vocalLead: e.target.value })}
            >
              <option value="">— Ninguno —</option>
              {members
                .filter((m) => !s.choir.includes(m.uid))
                .map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {nombreDe(m)}
                  </option>
                ))}
            </select>
          </div>

          <p className={styles.blockTitle} style={{ marginTop: '1.1rem' }}>
            Coro (2 o más)
          </p>
          <MemberPicker
            members={members.filter((m) => m.uid !== s.vocalLead)}
            selected={s.choir}
            onChange={(next) => updateSection(s.key, { choir: next })}
            placeholder="Agregar al coro…"
          />

          <p className={styles.blockTitle} style={{ marginTop: '1.1rem' }}>
            Músicos
          </p>
          <MusicianPicker
            members={members}
            selected={s.musicians}
            onChange={(next) => updateSection(s.key, { musicians: next })}
            instruments={instruments}
          />
        </section>
      ))}

      <div>
        <button type="button" className="btn btn-secondary" onClick={addSection}>
          + Agregar sección
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
