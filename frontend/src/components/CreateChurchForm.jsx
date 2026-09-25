import { useState } from 'react'
import { useChurch } from '../context/ChurchContext.jsx'

export default function CreateChurchForm({ onCreated }) {
  const { createChurch } = useChurch()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const church = await createChurch({ name, city })
      setName('')
      setCity('')
      onCreated?.(church)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h3>Crear iglesia</h3>
      <p className="muted">Crea una iglesia y serás su administrador.</p>
      <div className="field">
        <label htmlFor="church-name">Nombre</label>
        <input
          id="church-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="church-city">Ciudad (opcional)</label>
        <input
          id="church-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Creando…' : 'Crear iglesia'}
      </button>
    </form>
  )
}
