import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './Auth.module.css'

export default function Register() {
  const { user, signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error } = await signUp(email, password, fullName)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    // Si la confirmación por correo está desactivada, data.session ya existe.
    setDone(true)
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.box} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Crear cuenta</h1>
        <p className={styles.subtitle}>Regístrate para empezar a organizar tu equipo</p>

        <div className="field">
          <label htmlFor="fullName">Nombre completo</label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="error">{error}</p>}

        {done ? (
          <p className={styles.notice}>
            Cuenta creada. Si tu proyecto exige confirmación por correo, revisa tu
            bandeja de entrada antes de iniciar sesión.
          </p>
        ) : (
          <button className={`btn ${styles.submit}`} type="submit" disabled={busy}>
            {busy ? 'Creando…' : 'Registrarme'}
          </button>
        )}

        <p className={styles.switch}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  )
}
