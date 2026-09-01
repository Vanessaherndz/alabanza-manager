import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './Songs.module.css'

const EMPTY = { title: '', artist: '', song_key: '', bpm: '', reference_url: '' }

export default function Songs() {
  const { user } = useAuth()
  const { activeChurchId, isAdmin } = useChurch()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, artist, song_key, bpm, reference_url')
      .eq('church_id', activeChurchId)
      .order('title', { ascending: true })
    if (error) setError(error.message)
    else setSongs(data ?? [])
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setForm(EMPTY)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      church_id: activeChurchId,
      title: form.title,
      artist: form.artist || null,
      song_key: form.song_key || null,
      bpm: form.bpm ? Number(form.bpm) : null,
      reference_url: form.reference_url || null,
    }
    const query = editingId
      ? supabase.from('songs').update(payload).eq('id', editingId)
      : supabase.from('songs').insert({ ...payload, created_by: user.id })
    const { error } = await query
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    resetForm()
    load()
  }

  function startEdit(song) {
    setEditingId(song.id)
    setForm({
      title: song.title ?? '',
      artist: song.artist ?? '',
      song_key: song.song_key ?? '',
      bpm: song.bpm ?? '',
      reference_url: song.reference_url ?? '',
    })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta canción?')) return
    const { error } = await supabase.from('songs').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (!activeChurchId) {
    return <p className="muted">Selecciona o crea una iglesia primero.</p>
  }

  const filtered = songs.filter((s) =>
    `${s.title} ${s.artist ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className={styles.page}>
      <h1>Canciones</h1>

      {isAdmin && (
        <form className="card" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Editar canción' : 'Nueva canción'}</h3>
          <div className={styles.grid}>
            <div className="field">
              <label>Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Artista</label>
              <input
                value={form.artist}
                onChange={(e) => setForm({ ...form, artist: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tonalidad</label>
              <input
                value={form.song_key}
                onChange={(e) => setForm({ ...form, song_key: e.target.value })}
                placeholder="Ej: G, Am"
              />
            </div>
            <div className="field">
              <label>BPM</label>
              <input
                type="number"
                value={form.bpm}
                onChange={(e) => setForm({ ...form, bpm: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Enlace (YouTube, chart…)</label>
              <input
                type="url"
                value={form.reference_url}
                onChange={(e) => setForm({ ...form, reference_url: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <div className="field">
        <input
          placeholder="Buscar por título o artista…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No hay canciones.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Artista</th>
              <th>Tono</th>
              <th>BPM</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((song) => (
              <tr key={song.id}>
                <td>
                  {song.reference_url ? (
                    <a href={song.reference_url} target="_blank" rel="noreferrer">
                      {song.title}
                    </a>
                  ) : (
                    song.title
                  )}
                </td>
                <td>{song.artist || '—'}</td>
                <td>{song.song_key || '—'}</td>
                <td>{song.bpm || '—'}</td>
                {isAdmin && (
                  <td className={styles.rowActions}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => startEdit(song)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDelete(song.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
