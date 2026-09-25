import { useEffect, useState } from 'react'
import { useChurch } from '../context/ChurchContext.jsx'
import { api } from '../lib/apiClient.js'
import BackToMenu from '../components/BackToMenu.jsx'
import styles from './ChurchSettings.module.css'

function EditableList({ title, description, items, onSave }) {
  const [draft, setDraft] = useState('')
  const [list, setList] = useState(items)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setList(items)
  }, [items])

  function add() {
    const value = draft.trim()
    if (!value || list.includes(value)) return
    setList([...list, value])
    setDraft('')
  }

  function remove(value) {
    setList(list.filter((v) => v !== value))
  }

  async function handleSave() {
    setError('')
    setNotice('')
    if (list.length === 0) {
      setError('La lista debe tener al menos un valor.')
      return
    }
    setSaving(true)
    try {
      await onSave(list)
      setNotice('Cambios guardados.')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      <div className={styles.addRow}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Agregar…"
        />
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!draft.trim()}>
          + Agregar
        </button>
      </div>
      <div className={styles.chips}>
        {list.map((value) => (
          <span className={styles.chip} key={value}>
            {value}
            <button type="button" onClick={() => remove(value)} aria-label={`Quitar ${value}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="muted">{notice}</p>}
      <div className={styles.saveRow}>
        <button className="btn" type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </section>
  )
}

export default function ChurchSettings() {
  const { activeChurch, activeChurchId, updateChurchSettings } = useChurch()
  const [songCategories, setSongCategories] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/song-categories')
      .then((data) => setSongCategories(data ?? []))
      .catch((err) => setError(err.message))
  }, [])

  if (!activeChurchId) {
    return (
      <div className={styles.page}>
        <BackToMenu />
        <p className="muted">Selecciona o crea una iglesia primero.</p>
      </div>
    )
  }

  async function saveInstruments(instruments) {
    await updateChurchSettings({ instruments })
  }

  async function saveSongCategories(categories) {
    const updated = await api.patch('/song-categories', { categories })
    setSongCategories(updated)
  }

  return (
    <div className={styles.page}>
      <BackToMenu />
      <h1>Configuración{activeChurch?.name ? ` de ${activeChurch.name}` : ''}</h1>
      <p className="muted">
        Personaliza las opciones que se usan al armar servicios de esta iglesia.
      </p>

      {error && <p className="error">{error}</p>}

      <div className={styles.grid}>
        <EditableList
          title="Instrumentos"
          description="Solo para esta iglesia: opciones al asignar músicos y al elegir el instrumento principal de un miembro."
          items={activeChurch?.settings?.instruments ?? []}
          onSave={saveInstruments}
        />
        <EditableList
          title="Categorías de canciones"
          description="Compartidas por todas las iglesias: así se organiza el repertorio (ej: Adoración, Júbilo) para todos."
          items={songCategories}
          onSave={saveSongCategories}
        />
      </div>
    </div>
  )
}
