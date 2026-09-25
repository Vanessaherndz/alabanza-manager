import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import { buildRoleOptions } from '../lib/serviceRoles.js'
import ServiceSummaryTable from '../components/ServiceSummaryTable.jsx'
import BackToMenu from '../components/BackToMenu.jsx'
import Combobox from '../components/Combobox.jsx'
import styles from './ServiceDetail.module.css'

function fechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function nombreDe(profile) {
  return profile?.fullName || profile?.username || '—'
}

/** Sección del servicio: elige una existente o escribe una nueva. */
function SectionCombobox({ sections, value, onChange }) {
  const options = [...new Set([...sections, value].filter(Boolean))]
  return (
    <Combobox
      ariaLabel="Sección"
      placeholder="Buscar o escribir sección…"
      value={value}
      emptyLabel="Sin clasificar"
      options={options.map((s) => ({ value: s, label: s }))}
      onSelect={onChange}
      onCreate={onChange}
      createLabel={(texto) => `Nueva sección "${texto}"`}
    />
  )
}

export default function ServiceDetail() {
  const { id } = useParams()
  const { isAdmin, activeChurch } = useChurch()
  const roleOptions = buildRoleOptions(activeChurch?.settings?.instruments)

  const [event, setEvent] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const [songs, setSongs] = useState([]) // setlist del evento
  const [repertoire, setRepertoire] = useState([]) // songs de la iglesia
  const [team, setTeam] = useState([]) // asignaciones del evento
  const [members, setMembers] = useState([]) // miembros de la iglesia

  const [newSong, setNewSong] = useState({ songId: '', section: '', songKey: '' })
  const [newMember, setNewMember] = useState({ uid: '', role: '', roleOtro: '', section: '' })

  useEffect(() => {
    if (!newMember.role && roleOptions.length > 0) {
      setNewMember((prev) => ({ ...prev, role: roleOptions[0] }))
    }
  }, [roleOptions, newMember.role])

  const loadEvent = useCallback(async () => {
    try {
      const data = await api.get(`/events/${id}`)
      setEvent(data)
      setSongs(data.songs ?? [])
      setTeam(data.assignments ?? [])
    } catch (err) {
      if (err.status === 404) setNotFound(true)
      else setError(err.message)
    }
  }, [id])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  const churchId = event?.churchId

  useEffect(() => {
    if (!churchId) return
    api
      .get('/songs')
      .then((data) => setRepertoire(data ?? []))
      .catch((err) => setError(err.message))
    api
      .get(`/churches/${churchId}/members`)
      .then((data) => setMembers(data ?? []))
      .catch((err) => setError(err.message))
  }, [churchId])

  async function addSong(e) {
    e.preventDefault()
    setError('')
    if (!newSong.songId) return
    try {
      await api.post(`/events/${id}/songs`, {
        songId: newSong.songId,
        section: newSong.section || undefined,
        songKey: newSong.songKey || undefined,
      })
      setNewSong({ songId: '', section: '', songKey: '' })
      loadEvent()
    } catch (err) {
      setError(err.message)
    }
  }

  // Crea la alabanza en el repertorio y la deja elegida para agregarla.
  async function createSong(title) {
    setError('')
    try {
      const song = await api.post('/songs', { title })
      setRepertoire((prev) => [...prev, song].sort((a, b) => a.title.localeCompare(b.title)))
      setNewSong((prev) => ({ ...prev, songId: song.id }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeSong(rowId) {
    try {
      await api.delete(`/events/${id}/songs/${rowId}`)
      loadEvent()
    } catch (err) {
      setError(err.message)
    }
  }

  async function addMember(e) {
    e.preventDefault()
    setError('')
    if (!newMember.uid) return
    const role =
      newMember.role === 'Otro'
        ? newMember.roleOtro.trim() || undefined
        : newMember.role
    try {
      await api.post(`/events/${id}/assignments`, {
        uid: newMember.uid,
        role,
        section: newMember.section.trim() || undefined,
      })
      setNewMember({ uid: '', role: 'Piano', roleOtro: '', section: '' })
      loadEvent()
    } catch (err) {
      setError(
        /ya esta asignada/i.test(err.message)
          ? 'Esa persona ya está asignada con ese rol en esta sección.'
          : err.message,
      )
    }
  }

  async function setMemberStatus(rowId, status) {
    try {
      await api.patch(`/events/${id}/assignments/${rowId}`, { status })
      loadEvent()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeMember(rowId) {
    try {
      await api.delete(`/events/${id}/assignments/${rowId}`)
      loadEvent()
    } catch (err) {
      setError(err.message)
    }
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <BackToMenu to="/servicios" label="Servicios" />
        <p className="muted">No se encontró el servicio.</p>
      </div>
    )
  }

  if (!event) return <p>Cargando…</p>

  const disponibles = repertoire.filter(
    (s) => !songs.some((es) => es.song?.id === s.id),
  )

  const existingSections = [
    ...new Set(
      [...songs.map((es) => es.section), ...team.map((a) => a.section)].filter(Boolean),
    ),
  ]

  return (
    <div className={styles.page}>
      <BackToMenu to="/servicios" label="Servicios" />

      <div className={styles.head}>
        <h1>{event.title}</h1>
        <p className="muted">
          {fechaHora(event.startsAt)}
          {event.location ? (
            <>
              {' · '}
              <MapPin size={13} className={styles.inlineIcon} aria-hidden /> {event.location}
            </>
          ) : (
            ''
          )}
        </p>
        {event.notes && <p>{event.notes}</p>}
      </div>

      {error && <p className="error">{error}</p>}

      {/* -------------------- Resumen (sección · voz · alabanzas · músicos) -------------------- */}
      <section className="card">
        <h3>Hoja del servicio</h3>
        <ServiceSummaryTable
          songs={songs}
          team={team}
          isAdmin={isAdmin}
          onRemoveSong={removeSong}
          onRemoveMember={removeMember}
          onCycleStatus={setMemberStatus}
        />
      </section>

      {/* -------------------- Agregar alabanza -------------------- */}
      {isAdmin && (
        <section className="card">
          <h3>Agregar alabanza</h3>
          <form onSubmit={addSong}>
            <div className={styles.addGrid}>
              <div className="field">
                <label>Alabanza</label>
                <Combobox
                  ariaLabel="Alabanza"
                  placeholder="Buscar alabanza o escribir una nueva…"
                  value={newSong.songId}
                  options={disponibles.map((s) => ({ value: s.id, label: s.title, hint: s.songKey }))}
                  onSelect={(songId) => setNewSong({ ...newSong, songId })}
                  onCreate={createSong}
                  createLabel={(texto) => `Crear alabanza nueva "${texto}"`}
                />
              </div>
              <div className="field">
                <label>Sección</label>
                <SectionCombobox
                  sections={existingSections}
                  value={newSong.section}
                  onChange={(section) => setNewSong({ ...newSong, section })}
                />
              </div>
              <div className="field">
                <label>Tono (opcional)</label>
                <input
                  value={newSong.songKey}
                  onChange={(e) =>
                    setNewSong({ ...newSong, songKey: e.target.value })
                  }
                  placeholder="Ej: G, Am"
                />
              </div>
            </div>
            <button className="btn" type="submit" disabled={!newSong.songId}>
              Agregar alabanza
            </button>
            {disponibles.length === 0 && repertoire.length > 0 && (
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Ya agregaste todas las canciones del repertorio.
              </p>
            )}
            {repertoire.length === 0 && (
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                No hay canciones en el repertorio.{' '}
                <Link to="/canciones">Agregar canciones</Link>
              </p>
            )}
          </form>
        </section>
      )}

      {/* -------------------- Agregar al equipo -------------------- */}
      {isAdmin && (
        <section className="card">
          <h3>Agregar al equipo</h3>
          <form onSubmit={addMember}>
            <div className={styles.addGrid}>
              <div className="field">
                <label>Miembro</label>
                <Combobox
                  ariaLabel="Miembro"
                  placeholder="Buscar miembro…"
                  value={newMember.uid}
                  options={members.map((m) => ({ value: m.uid, label: nombreDe(m), hint: m.instrument }))}
                  onSelect={(uid) => {
                    // Propone su instrumento principal como rol.
                    const m = members.find((x) => x.uid === uid)
                    const role = roleOptions.includes(m?.instrument) ? m.instrument : newMember.role
                    setNewMember({ ...newMember, uid, role })
                  }}
                />
              </div>
              <div className="field">
                <label>Rol / instrumento</label>
                <Combobox
                  ariaLabel="Rol o instrumento"
                  placeholder="Buscar rol…"
                  value={newMember.role}
                  options={roleOptions.map((r) => ({ value: r, label: r }))}
                  onSelect={(role) => setNewMember({ ...newMember, role })}
                />
              </div>
              {newMember.role === 'Otro' && (
                <div className="field">
                  <label>Especificar</label>
                  <input
                    value={newMember.roleOtro}
                    onChange={(e) =>
                      setNewMember({ ...newMember, roleOtro: e.target.value })
                    }
                    placeholder="Ej: Percusión"
                  />
                </div>
              )}
              <div className="field">
                <label>Sección (opcional)</label>
                <SectionCombobox
                  sections={existingSections}
                  value={newMember.section}
                  onChange={(section) => setNewMember({ ...newMember, section })}
                />
              </div>
            </div>
            <button
              className="btn"
              type="submit"
              disabled={!newMember.uid}
            >
              Agregar al equipo
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
