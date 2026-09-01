import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p className="muted">La página que buscas no existe.</p>
      <Link to="/">Volver al panel</Link>
    </div>
  )
}
