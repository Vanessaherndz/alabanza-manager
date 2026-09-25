import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import { buildInstrumentOptions } from '../lib/serviceRoles.js'
import BackToMenu from '../components/BackToMenu.jsx'
import styles from './Songs.module.css'

const EMPTY_NEW = { fullName: '', instrument: '' }

export default function Members() {
  const { user } = useAuth()
  const { activeChurchId, activeChurch } = useChurch()
  const instruments = buildInstrumentOptions(activeChurch?.settings?.instruments)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [nuevo, setNuevo] = useState(EMPTY_NEW)
  const [creando, setCreando] = useState(false)

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    try {
      const data = await api.get(`/churches/${activeChurchId}/members`)
      setMembers(data ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCrear(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setCreando(true)
    try {
      await api.post(`/churches/${activeChurchId}/members`, {
        fullName: nuevo.fullName,
        instrument: nuevo.instrument || undefined,
      })
      setNotice(`"${nuevo.fullName}" agregado.`)
      setNuevo(EMPTY_NEW)
      load()
    } catch (err) {
      setError(err.message)
    }
    setCreando(false)
  }

  async function removeMember(uid) {
    if (!confirm('¿Quitar a este miembro?')) return
    try {
      await api.delete(`/churches/${activeChurchId}/members/${uid}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!activeChurchId) {
    return (
      <div className={styles.page}>
        <BackToMenu />
        <h1>Miembros</h1>
        <p className="muted">Selecciona o crea una iglesia primero.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <BackToMenu />
      <h1>Miembros</h1>

      <form className="card" onSubmit={handleCrear}>
        <h3>Agregar miembro</h3>
        <p className="muted">
          Solo hace falta el nombre y, si toca algún instrumento, cuál —eso
          se usa como valor por defecto al armar los servicios.
        </p>
        <div className={styles.grid}>
          <div className="field">
            <label>Nombre completo</label>
            <input
              value={nuevo.fullName}
              onChange={(e) => setNuevo({ ...nuevo, fullName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Instrumento principal (opcional)</label>
            <select
              value={nuevo.instrument}
              onChange={(e) => setNuevo({ ...nuevo, instrument: e.target.value })}
            >
              <option value="">Ninguno / voz</option>
              {instruments.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={creando}>
          {creando ? 'Agregando…' : 'Agregar miembro'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {notice && <p className="muted">{notice}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Instrumento</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td>{m.fullName || m.username || '—'}</td>
                  <td>{m.instrument || '—'}</td>
                  <td className={styles.rowActions}>
                    {m.uid !== user.uid && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => removeMember(m.uid)}
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
