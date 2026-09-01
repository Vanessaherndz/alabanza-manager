import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'
import { isValidUsername } from '../lib/username.js'
import styles from './Songs.module.css'

const EMPTY_NEW = { username: '', fullName: '', phone: '', password: '', role: 'user' }

export default function Members() {
  const { user, createAccount } = useAuth()
  const { activeChurchId } = useChurch()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [nuevo, setNuevo] = useState(EMPTY_NEW)
  const [creando, setCreando] = useState(false)

  const [existente, setExistente] = useState({ username: '', role: 'user' })
  const [agregando, setAgregando] = useState(false)

  const load = useCallback(async () => {
    if (!activeChurchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('church_members')
      .select('role, profile:profiles (id, username, full_name, phone)')
      .eq('church_id', activeChurchId)
    if (error) setError(error.message)
    else setMembers(data ?? [])
    setLoading(false)
  }, [activeChurchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCrear(e) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!isValidUsername(nuevo.username)) {
      setError(
        'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.',
      )
      return
    }
    if (nuevo.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setCreando(true)
    const { userId, error: createErr } = await createAccount({
      username: nuevo.username,
      password: nuevo.password,
      fullName: nuevo.fullName,
      phone: nuevo.phone,
    })

    if (createErr) {
      setCreando(false)
      setError(
        /already registered|exists/i.test(createErr.message)
          ? `El usuario "${nuevo.username}" ya existe.`
          : createErr.message,
      )
      return
    }

    // Vincular la cuenta recién creada a la iglesia activa.
    const { error: linkErr } = await supabase.rpc('add_member_by_username', {
      _church_id: activeChurchId,
      _username: nuevo.username.trim().toLowerCase(),
      _role: nuevo.role,
    })
    setCreando(false)

    if (linkErr) {
      setError(
        `La cuenta se creó (id ${userId ?? '?'}), pero no se pudo agregar a la iglesia: ${linkErr.message}`,
      )
      load()
      return
    }

    setNotice(`Cuenta "${nuevo.username}" creada y agregada a la iglesia.`)
    setNuevo(EMPTY_NEW)
    load()
  }

  async function handleAgregarExistente(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setAgregando(true)
    const { error } = await supabase.rpc('add_member_by_username', {
      _church_id: activeChurchId,
      _username: existente.username.trim().toLowerCase(),
      _role: existente.role,
    })
    setAgregando(false)
    if (error) {
      setError(error.message)
      return
    }
    setNotice(`"${existente.username}" agregado a la iglesia.`)
    setExistente({ username: '', role: 'user' })
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

  if (!activeChurchId) {
    return (
      <div className={styles.page}>
        <h1>Miembros</h1>
        <p className="muted">Selecciona o crea una iglesia primero.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1>Miembros</h1>

      <form className="card" onSubmit={handleCrear}>
        <h3>Crear cuenta nueva</h3>
        <p className="muted">
          Se crea el acceso (usuario + contraseña) y se agrega a esta iglesia.
          Comparte las credenciales con la persona.
        </p>
        <div className={styles.grid}>
          <div className="field">
            <label>Usuario</label>
            <input
              value={nuevo.username}
              onChange={(e) => setNuevo({ ...nuevo, username: e.target.value })}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
            />
          </div>
          <div className="field">
            <label>Nombre completo</label>
            <input
              value={nuevo.fullName}
              onChange={(e) => setNuevo({ ...nuevo, fullName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Teléfono (opcional)</label>
            <input
              value={nuevo.phone}
              onChange={(e) => setNuevo({ ...nuevo, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="text"
              value={nuevo.password}
              onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              minLength={6}
              required
            />
          </div>
          <div className="field">
            <label>Rol</label>
            <select
              value={nuevo.role}
              onChange={(e) => setNuevo({ ...nuevo, role: e.target.value })}
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={creando}>
          {creando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <form className="card" onSubmit={handleAgregarExistente}>
        <h3>Agregar usuario existente</h3>
        <p className="muted">
          Si la persona ya tiene una cuenta, agrégala a esta iglesia por su usuario.
        </p>
        <div className={styles.grid}>
          <div className="field">
            <label>Usuario</label>
            <input
              value={existente.username}
              onChange={(e) =>
                setExistente({ ...existente, username: e.target.value })
              }
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
            />
          </div>
          <div className="field">
            <label>Rol</label>
            <select
              value={existente.role}
              onChange={(e) =>
                setExistente({ ...existente, role: e.target.value })
              }
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={agregando}>
          {agregando ? 'Agregando…' : 'Agregar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {notice && <p className="muted">{notice}</p>}

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.profile.id}>
                <td>{m.profile.username || '—'}</td>
                <td>{m.profile.full_name || '—'}</td>
                <td>{m.profile.phone || '—'}</td>
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
