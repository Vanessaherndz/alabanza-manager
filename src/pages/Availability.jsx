import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './List.module.css'

export default function Availability() {
  const { user } = useAuth()
  const { activeChurchId } = useChurch()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ date: '', status: 'disponible', note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('availability')
      .select('id, date, status, note')
      .eq('church_id', activeChurchId)
      .eq('profile_id', user.id)
      .order('date', { ascending: true })
    if (error) setError(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [activeChurchId, user.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    // upsert por (church_id, profile_id, date)
    const { error } = await supabase.from('availability').upsert(
      {
        church_id: activeChurchId,
        profile_id: user.id,
        date: form.date,
        status: form.status,
        note: form.note || null,
      },
      { onConflict: 'church_id,profile_id,date' },
    )
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ date: '', status: 'disponible', note: '' })
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('availability').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (!activeChurchId) {
    return <p className="muted">Selecciona o crea una iglesia primero.</p>
  }

  return (
    <div className={styles.page}>
      <h1>Mi disponibilidad</h1>

      <form className="card" onSubmit={handleSubmit}>
        <h3>Marcar una fecha</h3>
        <div className="field">
          <label>Fecha</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Estado</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="disponible">Disponible</option>
            <option value="no_disponible">No disponible</option>
          </select>
        </div>
        <div className="field">
          <label>Nota (opcional)</label>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="muted">Sin fechas marcadas.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className="card">
              <div>
                <strong>{new Date(row.date + 'T00:00:00').toLocaleDateString('es')}</strong>
                <div className="muted">
                  {row.status === 'disponible' ? '✅ Disponible' : '⛔ No disponible'}
                  {row.note ? ` · ${row.note}` : ''}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => handleDelete(row.id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
