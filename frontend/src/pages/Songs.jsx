import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useChurch } from '../context/ChurchContext.jsx'
import BackToMenu from '../components/BackToMenu.jsx'
import styles from './Songs.module.css'

const EMPTY = { title: '', songKey: '', referenceUrl: '', category: '' }

// Pestañas especiales además de las categorías configuradas.
const ALL_TAB = '__todas'
const NO_CATEGORY_TAB = '__sin_categoria'

export default function Songs() {
  const { activeChurchId, isAdmin } = useChurch()
  const [songCategories, setSongCategories] = useState([])
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(ALL_TAB)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/songs')
      setSongs(data ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api
      .get('/song-categories')
      .then((data) => setSongCategories(data ?? []))
      .catch((err) => setError(err.message))
  }, [])

  function resetForm() {
    setForm(EMPTY)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      title: form.title,
      songKey: form.songKey || null,
      referenceUrl: form.referenceUrl || null,
      category: form.category || null,
    }
    try {
      if (editingId) {
        await api.patch(`/songs/${editingId}`, payload)
      } else {
        await api.post('/songs', payload)
      }
      resetForm()
      load()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  function startEdit(song) {
    setEditingId(song.id)
    setForm({
      title: song.title ?? '',
      songKey: song.songKey ?? '',
      referenceUrl: song.referenceUrl ?? '',
      category: song.category ?? '',
    })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta canción?')) return
    try {
      await api.delete(`/songs/${id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!activeChurchId) {
    return (
      <div className={styles.page}>
        <BackToMenu />
        <p className="muted">Selecciona o crea una iglesia primero.</p>
      </div>
    )
  }

  // Canciones sin categoría o con una que ya no está en la lista: se
  // agrupan en "Sin categoría" para que ninguna quede oculta.
  const isUncategorized = (s) => !s.category || !songCategories.includes(s.category)
  const countFor = (t) =>
    t === ALL_TAB
      ? songs.length
      : t === NO_CATEGORY_TAB
        ? songs.filter(isUncategorized).length
        : songs.filter((s) => s.category === t).length
  const tabs = [
    { value: ALL_TAB, label: 'Todas' },
    ...songCategories.map((c) => ({ value: c, label: c })),
    ...(countFor(NO_CATEGORY_TAB) > 0 ? [{ value: NO_CATEGORY_TAB, label: 'Sin categoría' }] : []),
  ]
  const tabLabel = tabs.find((t) => t.value === tab)?.label ?? tab

  const filtered = songs
    .filter((s) =>
      tab === ALL_TAB ? true : tab === NO_CATEGORY_TAB ? isUncategorized(s) : s.category === tab,
    )
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className={styles.page}>
      <BackToMenu />
      <h1>Canciones</h1>

      {error && <p className="error">{error}</p>}

      <div className={styles.layout}>
        <div className={styles.listCol}>
          <div className="field">
            <input
              placeholder="Buscar alabanza…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.tabs}>
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${styles.tab} ${tab === t.value ? styles.tabActive : ''}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
                <span className={styles.tabCount}>{countFor(t.value)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p>Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="muted">{search ? 'No hay alabanzas que coincidan con la búsqueda.' : `No hay alabanzas en "${tabLabel}".`}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Alabanza</th>
                    <th>Nota</th>
                    {isAdmin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((song) => (
                    <tr key={song.id}>
                      <td>
                        {song.referenceUrl ? (
                          <a href={song.referenceUrl} target="_blank" rel="noreferrer">
                            {song.title}
                          </a>
                        ) : (
                          song.title
                        )}
                      </td>
                      <td>{song.songKey || '—'}</td>
                      {isAdmin && (
                        <td className={styles.rowActions}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => startEdit(song)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDelete(song.id)}
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className={styles.formCol}>
            <form className="card" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Editar alabanza' : 'Nueva alabanza'}</h3>
              <div className="field">
                <label>Alabanza</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Nota</label>
                <input
                  value={form.songKey}
                  onChange={(e) => setForm({ ...form, songKey: e.target.value })}
                  placeholder="Ej: G, Am"
                />
              </div>
              <div className="field">
                <label>Link (opcional)</label>
                <input
                  type="url"
                  value={form.referenceUrl}
                  onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Lista</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">Sin clasificar</option>
                  {songCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
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
          </div>
        )}
      </div>
    </div>
  )
}
