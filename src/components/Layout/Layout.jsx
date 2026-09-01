import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useChurch } from '../../context/ChurchContext.jsx'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: 'Panel', end: true },
  { to: '/servicios', label: 'Servicios' },
  { to: '/ensayos', label: 'Ensayos' },
  { to: '/equipos', label: 'Equipos' },
  { to: '/canciones', label: 'Canciones' },
  { to: '/disponibilidad', label: 'Disponibilidad' },
  { to: '/miembros', label: 'Miembros', adminOnly: true },
]

export default function Layout() {
  const { profile, signOut, isSystemAdmin } = useAuth()
  const { memberships, activeChurchId, selectChurch, isAdmin } = useChurch()
  const navigate = useNavigate()
  const canAdmin = isAdmin || isSystemAdmin

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>🎵 Alabanza Manager</div>

        <label className={styles.churchPicker}>
          <span>Iglesia</span>
          <select
            value={activeChurchId ?? ''}
            onChange={(e) => selectChurch(e.target.value)}
          >
            {memberships.length === 0 && <option value="">Sin iglesias</option>}
            {memberships.map((m) => (
              <option key={m.church.id} value={m.church.id}>
                {m.church.name}
              </option>
            ))}
          </select>
        </label>

        <nav className={styles.nav}>
          {NAV.filter((item) => !item.adminOnly || canAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.linkActive}` : styles.link
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          <span className={styles.userEmail} title={profile?.username || ''}>
            {profile?.username || '…'}
            {isSystemAdmin && ' · admin sistema'}
          </span>
          <button className="btn btn-secondary" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
