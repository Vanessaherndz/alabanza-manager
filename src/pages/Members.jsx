import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import styles from './Songs.module.css'

export default function Members() {
  const { user } = useAuth()
  const { activeChurchId } = useChurch()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState({ email: '', role: 'user' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('church_members')
      .select('role, profile:profiles (id, full_name, email)')
      .eq('church_id', activeChurchId)
    if (error) setError(error.message)
    else setMembers(data ?? [])
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleInvite(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.rpc('add_member_by_email', {
      _church_id: activeChurchId,
      _email: invite.email,
      _role: invite.role,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setInvite({ email: '', role: 'user' })
    load()
  }

  async function changeRole(profileId, role) {
    const { error } = await supabase
      .from('church_members')
      .update({ role })
      .eq('church_id', activeChurchId)
      .eq('profile_id', profileId)
    if (error) setError(error.message)
    else load()
  }

  async function removeMember(profileId) {
    if (!confirm('¿Quitar a este miembro de la iglesia?')) return
    const { error } = await supabase
      .from('church_members')
      .delete()
      .eq('church_id', activeChurchId)
      .eq('profile_id', profileId)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className={styles.page}>
      <h1>Miembros</h1>

      <form className="card" onSubmit={handleInvite}>
        <h3>Agregar miembro</h3>
        <p className="muted">
          La persona debe tener una cuenta creada con ese correo.
        </p>
        <div className={styles.grid}>
          <div className="field">
            <label>Correo</label>
            <input
              type="email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Rol</label>
            <select
              value={invite.role}
              onChange={(e) => setInvite({ ...invite, role: e.target.value })}
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Agregando…' : 'Agregar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.profile.id}>
                <td>{m.profile.full_name || '—'}</td>
                <td>{m.profile.email || '—'}</td>
                <td>
                  <select
                    value={m.role}
                    disabled={m.profile.id === user.id}
                    onChange={(e) => changeRole(m.profile.id, e.target.value)}
                  >
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td className={styles.rowActions}>
                  {m.profile.id !== user.id && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => removeMember(m.profile.id)}
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
