import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import { buildRoleOptions } from '../lib/serviceRoles.js'
import ServiceSummaryTable from '../components/ServiceSummaryTable.jsx'
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
          ? 'Esa persona ya está asignada con ese rol.'
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
        <Link to="/servicios" className={`btn btn-secondary ${styles.back}`}>
          ← Servicios
        </Link>
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
      <datalist id="secciones-existentes">
        {existingSections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Link to="/servicios" className={`btn btn-secondary ${styles.back}`}>
        ← Servicios
      </Link>

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
                <select
                  value={newSong.songId}
                  onChange={(e) =>
                    setNewSong({ ...newSong, songId: e.target.value })
                  }
                  required
                >
                  <option value="">Elegir del repertorio…</option>
                  {disponibles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {s.songKey ? ` (${s.songKey})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Sección</label>
                <input
                  value={newSong.section}
                  onChange={(e) =>
                    setNewSong({ ...newSong, section: e.target.value })
                  }
                  placeholder="Sin clasificar"
                  list="secciones-existentes"
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
                <select
                  value={newMember.uid}
                  onChange={(e) =>
                    setNewMember({ ...newMember, uid: e.target.value })
                  }
                  required
                >
                  <option value="">Elegir miembro…</option>
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {nombreDe(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Rol / instrumento</label>
                <select
                  value={newMember.role}
                  onChange={(e) =>
                    setNewMember({ ...newMember, role: e.target.value })
                  }
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
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
                <input
                  value={newMember.section}
                  onChange={(e) =>
                    setNewMember({ ...newMember, section: e.target.value })
                  }
                  placeholder="Sin clasificar"
                  list="secciones-existentes"
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
