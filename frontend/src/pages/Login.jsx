import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './Auth.module.css'

export default function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = location.state?.from?.pathname || '/'

  if (user) return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(usuario, password)
    setBusy(false)
    if (error) {
      setError('Usuario o contraseña incorrectos.')
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.box} onSubmit={handleSubmit}>
        <div className={styles.logo} aria-hidden>
          <img src="/logo-koala-white.png" alt="" className={styles.logoIcon} />
        </div>
        <h1 className={styles.title}>Iniciar sesión</h1>
        <p className={styles.subtitle}>Gestión de servicios de alabanza</p>

        <div className="field">
          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button className={`btn ${styles.submit}`} type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        <p className={styles.switch}>
          ¿No tienes cuenta? Pídele al administrador que te la cree.
        </p>
      </form>
    </div>
  )
}
