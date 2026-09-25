import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useChurch } from '../../context/ChurchContext.jsx'
import styles from './Layout.module.css'

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

export default function Layout() {
  const { profile, signOut, isSystemAdmin } = useAuth()
  const { memberships, activeChurchId, selectChurch, activeChurch } = useChurch()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>
          <img src="/logo-koala-white.png" alt="" className={styles.brandIcon} />
          <span>Alabanza</span>
        </Link>

        <div className={styles.topbarRight}>
          {memberships.length > 1 ? (
            <select
              className={styles.churchPicker}
              value={activeChurchId ?? ''}
              onChange={(e) => selectChurch(e.target.value)}
              aria-label="Iglesia activa"
            >
              {memberships.map((m) => (
                <option key={m.church.id} value={m.church.id}>
                  {m.church.name}
                </option>
              ))}
            </select>
          ) : (
            activeChurch && <span className={styles.churchName}>{activeChurch.name}</span>
          )}

          <Link to="/iglesias/nueva" className="btn btn-secondary" title="Crear otra iglesia">
            + Iglesia
          </Link>

          <div className={styles.userChip}>
            <span className={styles.userAvatar}>
              {iniciales(profile?.fullName || profile?.username)}
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
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
