import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// TEMPORAL: bypass de login mientras "Email" está deshabilitado en Supabase Auth.
// Revertir apenas se pueda iniciar sesión de verdad (quitar el `if (BYPASS...)`).
const BYPASS_AUTH = true

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (BYPASS_AUTH) return children

  if (loading) return <div style={{ padding: '2rem' }}>Cargando…</div>

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
