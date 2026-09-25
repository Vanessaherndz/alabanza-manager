import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import styles from './BackToMenu.module.css'

// Enlace de regreso discreto que va sobre el título de cada página.
export default function BackToMenu({ to = '/', label = 'Inicio' }) {
  return (
    <Link to={to} className={styles.back}>
      <ChevronLeft size={16} aria-hidden />
      {label}
    </Link>
  )
}
