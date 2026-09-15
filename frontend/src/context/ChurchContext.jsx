import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from './AuthContext.jsx'

const ChurchContext = createContext(null)
const STORAGE_KEY = 'alabanza:activeChurchId'

export function ChurchProvider({ children }) {
  const { user } = useAuth()
  const [churches, setChurches] = useState([])
  const [activeChurchId, setActiveChurchId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null,
  )
  const [loading, setLoading] = useState(true)

  const loadChurches = useCallback(async () => {
    if (!user) {
      setChurches([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await api.get('/churches')
      setChurches(data ?? [])
    } catch (err) {
      console.error('Error cargando iglesias:', err.message)
      setChurches([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadChurches()
  }, [loadChurches])

  // Mantiene una iglesia activa valida
  useEffect(() => {
    if (loading) return
    const ids = churches.map((c) => c.id)
    if (activeChurchId && ids.includes(activeChurchId)) return
    const next = ids[0] ?? null
    setActiveChurchId(next)
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  }, [churches, activeChurchId, loading])

  const selectChurch = useCallback((id) => {
    setActiveChurchId(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const createChurch = useCallback(
    async ({ name, city }) => {
      const church = await api.post('/churches', { name, city: city || undefined })
      await loadChurches()
      selectChurch(church.id)
      return church
    },
    [loadChurches, selectChurch],
  )

  const activeChurch = churches.find((c) => c.id === activeChurchId) ?? null

  const value = useMemo(
    () => ({
      loading,
      churches,
      memberships: churches.map((c) => ({ role: c.role, church: c })),
      activeChurchId,
      activeChurch,
      role: activeChurch?.role ?? null,
      isAdmin: activeChurch?.role === 'admin',
      selectChurch,
      createChurch,
      refresh: loadChurches,
    }),
    [loading, churches, activeChurchId, activeChurch, selectChurch, createChurch, loadChurches],
  )

  return <ChurchContext.Provider value={value}>{children}</ChurchContext.Provider>
}

export function useChurch() {
  const ctx = useContext(ChurchContext)
  if (!ctx) throw new Error('useChurch debe usarse dentro de <ChurchProvider>')
  return ctx
}
