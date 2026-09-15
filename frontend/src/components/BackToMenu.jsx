import { Link } from 'react-router-dom'
import styles from './BackToMenu.module.css'

export default function BackToMenu() {
  return (
    <Link to="/" className={`btn ${styles.back}`}>
      <img src="/logo-koala-white.png" alt="" className={styles.icon} />
      Menú
    </Link>
  )
}
