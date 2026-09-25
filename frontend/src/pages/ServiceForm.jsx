import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import { buildInstrumentOptions, VOICE_LEAD_ROLE, CHOIR_ROLE } from '../lib/serviceRoles.js'
import BackToMenu from '../components/BackToMenu.jsx'
import Combobox from '../components/Combobox.jsx'
import MusicianPicker from '../components/MusicianPicker.jsx'
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
    vocalLeads: [],
    choir: [],
    musicians: [], // [{ uid, instrument }]
  }
}

/** Selector de personas con búsqueda y "chips" (permite varias). */
function MemberPicker({ members, selected, onChange, placeholder }) {
  const disponibles = members.filter((m) => !selected.includes(m.uid))
  return (
    <div>
      <div className={styles.picker}>
        <Combobox
          placeholder={placeholder}
          options={disponibles.map((m) => ({ value: m.uid, label: nombreDe(m), hint: m.instrument }))}
          onSelect={(uid) => onChange([...selected, uid])}
        />
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
                  aria-label={`Quitar a ${nombreDe(m)}`}
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

/**
 * Selector de canciones con búsqueda y "chips". Si el título escrito no está
 * en el repertorio, ofrece crear la alabanza nueva ahí mismo.
 */
function SongPicker({ repertoire, taken, selected, onChange, onCreate }) {
  const [creando, setCreando] = useState(false)
  const disponibles = repertoire.filter((s) => !taken.includes(s.id) && !selected.includes(s.id))

  async function handleCreate(title) {
    setCreando(true)
    await onCreate(title)
    setCreando(false)
  }

  return (
    <div>
      <div className={styles.picker}>
        <Combobox
          placeholder={creando ? 'Agregando alabanza…' : 'Buscar alabanza o escribir una nueva…'}
          disabled={creando}
          options={disponibles.map((s) => ({ value: s.id, label: s.title, hint: s.songKey }))}
          onSelect={(id) => onChange([...selected, id])}
          onCreate={handleCreate}
          createLabel={(texto) => `Crear alabanza nueva "${texto}"`}
        />
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
                  aria-label={`Quitar ${s?.title ?? 'alabanza'}`}
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
  const [teams, setTeams] = useState([])
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
    api
      .get(`/churches/${activeChurchId}/teams`)
      .then((data) => setTeams(data ?? []))
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

  // Agrega los integrantes del grupo a los músicos de la sección (sin repetir
  // a quien ya esté). Luego se pueden quitar o agregar uno por uno.
  function applyTeam(sectionKey, teamId) {
    const team = teams.find((t) => t.id === teamId)
    if (!team) return
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s
        const nuevos = team.members
          .filter((tm) => members.some((m) => m.uid === tm.uid))
          .filter((tm) => !s.musicians.some((x) => x.uid === tm.uid))
          .map((tm) => ({
            uid: tm.uid,
            instrument:
              tm.instrument ||
              members.find((m) => m.uid === tm.uid)?.instrument ||
              instruments[0],
          }))
        return { ...s, musicians: [...s.musicians, ...nuevos] }
      }),
    )
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
      for (const uid of s.vocalLeads) {
        assignments.push({ uid, role: VOICE_LEAD_ROLE, section: s.name.trim() })
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
      <BackToMenu to="/servicios" label="Servicios" />
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
          <MemberPicker
            members={members.filter((m) => !s.choir.includes(m.uid))}
            selected={s.vocalLeads}
            onChange={(next) => updateSection(s.key, { vocalLeads: next })}
            placeholder="Agregar voz principal…"
          />

          <p className={styles.blockTitle} style={{ marginTop: '1.1rem' }}>
            Coro (2 o más)
          </p>
          <MemberPicker
            members={members.filter((m) => !s.vocalLeads.includes(m.uid))}
            selected={s.choir}
            onChange={(next) => updateSection(s.key, { choir: next })}
            placeholder="Agregar al coro…"
          />

          <div className={styles.blockHead}>
            <p className={styles.blockTitle}>Músicos</p>
            {teams.length > 0 && (
              <div className={styles.teamSelect}>
                <Combobox
                  size="sm"
                  placeholder="Usar grupo…"
                  ariaLabel="Usar un grupo de músicos"
                  options={teams.map((t) => ({
                    value: t.id,
                    label: t.name,
                    hint: `${t.members.length} ${t.members.length === 1 ? 'músico' : 'músicos'}`,
                  }))}
                  onSelect={(teamId) => applyTeam(s.key, teamId)}
                />
              </div>
            )}
          </div>
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
