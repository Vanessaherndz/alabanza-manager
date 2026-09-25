import { useNavigate } from 'react-router-dom'
import BackToMenu from '../components/BackToMenu.jsx'
import CreateChurchForm from '../components/CreateChurchForm.jsx'
import styles from './Dashboard.module.css'

export default function NewChurch() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <BackToMenu />
      <h1>Nueva iglesia</h1>
      <CreateChurchForm onCreated={() => navigate('/')} />
    </div>
  )
}
