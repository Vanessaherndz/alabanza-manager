import { Navigate } from 'react-router-dom'
import { useChurch } from '../context/ChurchContext.jsx'

/**
 * Restringe una ruta segun el rol en la iglesia activa.
 * Uso: <RoleRoute allow={['admin']}> ... </RoleRoute>
 */
export default function RoleRoute({ allow = ['admin'], children }) {
  const { loading, role } = useChurch()

  if (loading) return <div style={{ padding: '2rem' }}>Cargando…</div>

  if (!role || !allow.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}
