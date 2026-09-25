import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Moon, Plus, Sun } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useChurch } from '../../context/ChurchContext.jsx'
import { useTheme } from '../../lib/theme.js'
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
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Cierra el menú del usuario al navegar, al hacer clic fuera o con Escape.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

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

          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className={styles.userMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.userChip}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className={styles.userAvatar}>
                {iniciales(profile?.fullName || profile?.username)}
              </span>
              <span className={styles.userInfo}>
                <span className={styles.userName}>{profile?.username || '…'}</span>
                {isSystemAdmin && <span className={styles.userTag}>Admin del sistema</span>}
              </span>
              <ChevronDown size={16} className={styles.chevron} aria-hidden />
            </button>

            {menuOpen && (
              <div className={styles.menu} role="menu">
                <Link to="/iglesias/nueva" className={styles.menuItem} role="menuitem">
                  <Plus size={16} aria-hidden />
                  Crear iglesia
                </Link>
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuDanger}`}
                  role="menuitem"
                  onClick={handleSignOut}
                >
                  <LogOut size={16} aria-hidden />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
