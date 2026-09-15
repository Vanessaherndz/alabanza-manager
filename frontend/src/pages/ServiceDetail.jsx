import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import { ROLE_OPTIONS, VOICE_LEAD_ROLE, CHOIR_ROLE } from '../lib/serviceRoles.js'
import { groupBySection } from '../lib/groupBySection.js'
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

const STATUS_META = {
  invitado: { label: 'Pendiente', cls: 'stPending' },
  confirmado: { label: 'Confirmada', cls: 'stConfirm' },
  rechazado: { label: 'Rechazada', cls: 'stReject' },
}

function nextStatus(status) {
  if (status === 'invitado') return 'confirmado'
  if (status === 'confirmado') return 'rechazado'
  return 'invitado'
}

/** Nombre + estado (punto cliqueable) + rol + quitar, para una celda de la hoja. */
function TeamChip({ a, tag, isAdmin, onRemove, onCycleStatus }) {
  const meta = STATUS_META[a.status] ?? { label: a.status, cls: '' }
  return (
    <div className={styles.cellItem}>
      <button
        type="button"
        className={`${styles.statusDot} ${styles[meta.cls] ?? ''}`}
        title={`Estado: ${meta.label}${isAdmin ? ' (clic para cambiar)' : ''}`}
        aria-label={`Estado: ${meta.label}`}
        disabled={!isAdmin}
        onClick={() => onCycleStatus(a.id, nextStatus(a.status))}
      />
      <span>{nombreDe(a.profile)}</span>
      <span className={styles.cellTag}>{tag}</span>
      {isAdmin && (
        <button className={styles.miniRemove} onClick={() => onRemove(a.id)} aria-label="Quitar">
          ×
        </button>
      )}
    </div>
  )
}

export default function ServiceDetail() {
  const { id } = useParams()
  const { isAdmin } = useChurch()

  const [event, setEvent] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const [songs, setSongs] = useState([]) // setlist del evento
  const [repertoire, setRepertoire] = useState([]) // songs de la iglesia
  const [team, setTeam] = useState([]) // asignaciones del evento
  const [members, setMembers] = useState([]) // miembros de la iglesia

  const [newSong, setNewSong] = useState({ songId: '', section: '', songKey: '' })
  const [newMember, setNewMember] = useState({ uid: '', role: 'Piano', roleOtro: '', section: '' })

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
      .get(`/churches/${churchId}/songs`)
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

  // Las secciones tienen nombre libre: se agrupan en el orden en que aparecen
  // (que ya viene dado por la posición de cada alabanza en el setlist).
  const grupos = groupBySection(songs)

  const existingSections = [
    ...new Set(
      [...songs.map((es) => es.section), ...team.map((a) => a.section)].filter(Boolean),
    ),
  ]

  // Equipo agrupado por sección, en el mismo orden que las alabanzas; dentro
  // de cada sección: voz principal, luego coro, luego el resto (músicos).
  function ordenRol(role) {
    if (role === VOICE_LEAD_ROLE) return 0
    if (role === CHOIR_ROLE) return 1
    return 2
  }
  const teamGrupos = groupBySection(team, grupos.map((g) => g.name)).map((g) => ({
    ...g,
    items: [...g.items].sort((a, b) => ordenRol(a.role) - ordenRol(b.role)),
  }))

  // Resumen tipo "hoja de servicio": una fila por sección, con Voz,
  // Alabanzas y Músicos como columnas.
  const sectionRows = [
    ...new Set([...grupos.map((g) => g.name), ...teamGrupos.map((g) => g.name)]),
  ].map((name) => {
    const sectionSongs = grupos.find((g) => g.name === name)?.items ?? []
    const sectionTeam = teamGrupos.find((g) => g.name === name)?.items ?? []
    return {
      name,
      songs: sectionSongs,
      vocalLead: sectionTeam.find((a) => a.role === VOICE_LEAD_ROLE) ?? null,
      choir: sectionTeam.filter((a) => a.role === CHOIR_ROLE),
      musicians: sectionTeam.filter((a) => a.role !== VOICE_LEAD_ROLE && a.role !== CHOIR_ROLE),
    }
  })

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

        {sectionRows.length === 0 ? (
          <p className="muted">Aún no hay secciones configuradas en este servicio.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.summaryTable}>
              <thead>
                <tr>
                  <th>Sección</th>
                  <th>Voz</th>
                  <th>Alabanzas</th>
                  <th>Músicos</th>
                </tr>
              </thead>
              <tbody>
                {sectionRows.map((row) => (
                  <tr key={row.name}>
                    <td className={styles.sectionCell}>{row.name}</td>
                    <td>
                      {!row.vocalLead && row.choir.length === 0 && (
                        <span className="muted">—</span>
                      )}
                      {row.vocalLead && (
                        <TeamChip
                          a={row.vocalLead}
                          tag="Voz principal"
                          isAdmin={isAdmin}
                          onRemove={removeMember}
                          onCycleStatus={setMemberStatus}
                        />
                      )}
                      {row.choir.map((a) => (
                        <TeamChip
                          key={a.id}
                          a={a}
                          tag="Coro"
                          isAdmin={isAdmin}
                          onRemove={removeMember}
                          onCycleStatus={setMemberStatus}
                        />
                      ))}
                    </td>
                    <td>
                      {row.songs.length === 0 && <span className="muted">—</span>}
                      {row.songs.map((es) => (
                        <div className={styles.cellItem} key={es.id}>
                          <span>{es.song?.title ?? '—'}</span>
                          <span className={styles.cellTag}>
                            {es.songKey || es.song?.songKey || '—'}
                          </span>
                          {isAdmin && (
                            <button
                              className={styles.miniRemove}
                              onClick={() => removeSong(es.id)}
                              aria-label="Quitar"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </td>
                    <td>
                      {row.musicians.length === 0 && <span className="muted">—</span>}
                      {row.musicians.map((a) => (
                        <TeamChip
                          key={a.id}
                          a={a}
                          tag={a.role || 'Sin rol'}
                          isAdmin={isAdmin}
                          onRemove={removeMember}
                          onCycleStatus={setMemberStatus}
                        />
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  {ROLE_OPTIONS.map((r) => (
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
