import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useChurch } from '../context/ChurchContext.jsx'

/**
 * Restringe una ruta segun el rol en la iglesia activa.
 * El administrador del sistema siempre pasa.
 * Uso: <RoleRoute allow={['admin']}> ... </RoleRoute>
 */
export default function RoleRoute({ allow = ['admin'], children }) {
  const { isSystemAdmin } = useAuth()
  const { loading, role } = useChurch()

  if (isSystemAdmin) return children

  if (loading) return <div style={{ padding: '2rem' }}>Cargando…</div>

  if (!role || !allow.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}
