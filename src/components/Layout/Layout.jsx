import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useChurch } from '../../context/ChurchContext.jsx'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: 'Panel', end: true, icon: '▦' },
  { to: '/servicios', label: 'Servicios', icon: '🎤' },
  { to: '/equipos', label: 'Equipos', icon: '👥' },
  { to: '/canciones', label: 'Canciones', icon: '🎵' },
  { to: '/miembros', label: 'Miembros', icon: '🛡️', adminOnly: true },
]

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

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
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden>
            <img src="/logo-koala-white.png" alt="" className={styles.brandIcon} />
          </span>
          Alabanza Manager
        </div>

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
              <span className={styles.linkIcon} aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.userChip}>
            <span className={styles.userAvatar}>
              {iniciales(profile?.full_name || profile?.username)}
            </span>
            <span className={styles.userInfo}>
              <span className={styles.userName}>{profile?.username || '…'}</span>
              {isSystemAdmin && <span className={styles.userTag}>Admin del sistema</span>}
            </span>
          </div>
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
