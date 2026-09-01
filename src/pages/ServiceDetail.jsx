import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import { SERVICE_SECTIONS, SIN_SECCION } from '../lib/serviceSections.js'
import styles from './ServiceDetail.module.css'

const STATUS_OPTIONS = [
  { value: 'invitado', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmada' },
  { value: 'rechazado', label: 'Rechazada' },
]

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
  return profile?.full_name || profile?.username || '—'
}

export default function ServiceDetail() {
  const { id } = useParams()
  const { activeChurchId, isAdmin } = useChurch()

  const [event, setEvent] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const [songs, setSongs] = useState([]) // event_songs
  const [repertoire, setRepertoire] = useState([]) // songs de la iglesia
  const [team, setTeam] = useState([]) // event_assignments
  const [members, setMembers] = useState([]) // church_members -> profiles

  const [newSong, setNewSong] = useState({ songId: '', section: '', song_key: '' })
  const [newMember, setNewMember] = useState({ profileId: '', role: '' })

  const loadEvent = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, church_id, type, title, starts_at, location, notes')
      .eq('id', id)
      .maybeSingle()
    if (error) setError(error.message)
    if (!data) {
      setNotFound(true)
      return
    }
    setEvent(data)
  }, [id])

  const loadSongs = useCallback(async () => {
    const { data } = await supabase
      .from('event_songs')
      .select('id, position, song_key, section, song:songs (id, title, artist, song_key, bpm)')
      .eq('event_id', id)
      .order('position', { ascending: true })
    setSongs(data ?? [])
  }, [id])

  const loadTeam = useCallback(async () => {
    const { data } = await supabase
      .from('event_assignments')
      .select('id, role, status, profile:profiles (id, username, full_name)')
      .eq('event_id', id)
      .order('created_at', { ascending: true })
    setTeam(data ?? [])
  }, [id])

  useEffect(() => {
    loadEvent()
    loadSongs()
    loadTeam()
  }, [loadEvent, loadSongs, loadTeam])

  const churchId = event?.church_id ?? activeChurchId

  useEffect(() => {
    if (!churchId) return
    supabase
      .from('songs')
      .select('id, title, artist, song_key, bpm')
      .eq('church_id', churchId)
      .order('title', { ascending: true })
      .then(({ data }) => setRepertoire(data ?? []))
    supabase
      .from('church_members')
      .select('profile:profiles (id, username, full_name)')
      .eq('church_id', churchId)
      .then(({ data }) =>
        setMembers((data ?? []).map((r) => r.profile).filter(Boolean)),
      )
  }, [churchId])

  async function addSong(e) {
    e.preventDefault()
    setError('')
    if (!newSong.songId) return
    const nextPos =
      songs.reduce((max, s) => Math.max(max, s.position ?? 0), 0) + 1
    const { error } = await supabase.from('event_songs').insert({
      event_id: id,
      song_id: newSong.songId,
      position: nextPos,
      section: newSong.section || null,
      song_key: newSong.song_key || null,
    })
    if (error) {
      setError(error.message)
      return
    }
    setNewSong({ songId: '', section: '', song_key: '' })
    loadSongs()
  }

  async function setSongSection(rowId, section) {
    const { error } = await supabase
      .from('event_songs')
      .update({ section: section || null })
      .eq('id', rowId)
    if (error) setError(error.message)
    else loadSongs()
  }

  async function removeSong(rowId) {
    const { error } = await supabase.from('event_songs').delete().eq('id', rowId)
    if (error) setError(error.message)
    else loadSongs()
  }

  async function addMember(e) {
    e.preventDefault()
    setError('')
    if (!newMember.profileId) return
    const { error } = await supabase.from('event_assignments').insert({
      event_id: id,
      profile_id: newMember.profileId,
      role: newMember.role || null,
      status: 'invitado',
    })
    if (error) {
      setError(
        /duplicate key/i.test(error.message)
          ? 'Esa persona ya está asignada con ese rol.'
          : error.message,
      )
      return
    }
    setNewMember({ profileId: '', role: '' })
    loadTeam()
  }

  async function setMemberStatus(rowId, status) {
    const { error } = await supabase
      .from('event_assignments')
      .update({ status })
      .eq('id', rowId)
    if (error) setError(error.message)
    else loadTeam()
  }

  async function removeMember(rowId) {
    const { error } = await supabase
      .from('event_assignments')
      .delete()
      .eq('id', rowId)
    if (error) setError(error.message)
    else loadTeam()
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <Link to="/servicios" className={styles.back}>
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

  const grupos = [...SERVICE_SECTIONS, SIN_SECCION]
    .map((name) => ({
      name,
      items: songs.filter((es) => (es.section || SIN_SECCION) === name),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className={styles.page}>
      <Link to="/servicios" className={styles.back}>
        ← Servicios
      </Link>

      <div className={styles.head}>
        <h1>{event.title}</h1>
        <p className="muted">
          {fechaHora(event.starts_at)}
          {event.location ? ` · 📍 ${event.location}` : ''}
        </p>
        {event.notes && <p>{event.notes}</p>}
      </div>

      {error && <p className="error">{error}</p>}

      {/* -------------------- Alabanzas -------------------- */}
      <section className="card">
        <h3>Alabanzas</h3>

        {songs.length === 0 && (
          <p className="muted">Aún no hay alabanzas en este servicio.</p>
        )}

        {grupos.map((g) => (
          <div key={g.name}>
            <p className={styles.sectionTitle}>{g.name}</p>
            {g.items.map((es, i) => (
              <div className={styles.row} key={es.id}>
                <span className={styles.pos}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {es.song?.title ?? '—'}
                  </span>
                  <span className={styles.rowMeta}>
                    {es.song?.artist ? `${es.song.artist} · ` : ''}
                    Tono {es.song_key || es.song?.song_key || '—'}
                    {es.song?.bpm ? ` · ${es.song.bpm} BPM` : ''}
                  </span>
                </span>
                <span className={styles.rowActions}>
                  {isAdmin ? (
                    <>
                      <select
                        value={es.section || ''}
                        onChange={(e) => setSongSection(es.id, e.target.value)}
                      >
                        <option value="">— momento —</option>
                        {SERVICE_SECTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        className={`btn btn-secondary ${styles.mini}`}
                        onClick={() => removeSong(es.id)}
                      >
                        Quitar
                      </button>
                    </>
                  ) : (
                    <span className={styles.rowMeta}>{es.section || ''}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}

        {isAdmin && (
          <form onSubmit={addSong} style={{ marginTop: '1rem' }}>
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
                      {s.artist ? ` — ${s.artist}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Momento</label>
                <select
                  value={newSong.section}
                  onChange={(e) =>
                    setNewSong({ ...newSong, section: e.target.value })
                  }
                >
                  <option value="">Sin clasificar</option>
                  {SERVICE_SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tono (opcional)</label>
                <input
                  value={newSong.song_key}
                  onChange={(e) =>
                    setNewSong({ ...newSong, song_key: e.target.value })
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
        )}
      </section>

      {/* -------------------- Equipo -------------------- */}
      <section className="card">
        <h3>Equipo del servicio</h3>

        {team.length === 0 && (
          <p className="muted">Aún no hay nadie asignado.</p>
        )}

        {team.map((a) => (
          <div className={styles.row} key={a.id}>
            <span className={styles.pos} aria-hidden>
              •
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{nombreDe(a.profile)}</span>
              <span className={styles.rowMeta}>{a.role || 'Sin rol'}</span>
            </span>
            <span className={styles.rowActions}>
              {isAdmin ? (
                <>
                  <select
                    value={a.status}
                    onChange={(e) => setMemberStatus(a.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`btn btn-secondary ${styles.mini}`}
                    onClick={() => removeMember(a.id)}
                  >
                    Quitar
                  </button>
                </>
              ) : (
                <span className={styles.rowMeta}>
                  {STATUS_OPTIONS.find((o) => o.value === a.status)?.label}
                </span>
              )}
            </span>
          </div>
        ))}

        {isAdmin && (
          <form onSubmit={addMember} style={{ marginTop: '1rem' }}>
            <div className={styles.addGrid}>
              <div className="field">
                <label>Miembro</label>
                <select
                  value={newMember.profileId}
                  onChange={(e) =>
                    setNewMember({ ...newMember, profileId: e.target.value })
                  }
                  required
                >
                  <option value="">Elegir miembro…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {nombreDe(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Rol / instrumento</label>
                <input
                  value={newMember.role}
                  onChange={(e) =>
                    setNewMember({ ...newMember, role: e.target.value })
                  }
                  placeholder="Voz, Guitarra, Batería…"
                />
              </div>
            </div>
            <button
              className="btn"
              type="submit"
              disabled={!newMember.profileId}
            >
              Agregar al equipo
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
