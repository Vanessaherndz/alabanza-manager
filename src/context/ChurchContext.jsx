import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from './AuthContext.jsx'

const ChurchContext = createContext(null)
const STORAGE_KEY = 'alabanza:activeChurchId'

export function ChurchProvider({ children }) {
  const { user, isSystemAdmin } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [activeChurchId, setActiveChurchId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null,
  )
  const [loading, setLoading] = useState(true)

  const loadMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setLoading(false)
      return
    }
    setLoading(true)

    // El admin del sistema gestiona todas las iglesias.
    if (isSystemAdmin) {
      const { data, error } = await supabase
        .from('churches')
        .select('id, name, city')
        .order('name')
      if (error) {
        console.error('Error cargando iglesias:', error.message)
        setMemberships([])
      } else {
        setMemberships((data ?? []).map((church) => ({ role: 'admin', church })))
      }
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('church_members')
      .select('role, church:churches (id, name, city)')
      .eq('profile_id', user.id)

    if (error) {
      console.error('Error cargando iglesias:', error.message)
      setMemberships([])
    } else {
      setMemberships(data ?? [])
    }
    setLoading(false)
  }, [user, isSystemAdmin])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

  // Mantiene una iglesia activa valida
  useEffect(() => {
    if (loading) return
    const ids = memberships.map((m) => m.church.id)
    if (activeChurchId && ids.includes(activeChurchId)) return
    const next = ids[0] ?? null
    setActiveChurchId(next)
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  }, [memberships, activeChurchId, loading])

  const selectChurch = useCallback((id) => {
    setActiveChurchId(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const activeMembership =
    memberships.find((m) => m.church.id === activeChurchId) ?? null

  const value = useMemo(
    () => ({
      loading,
      memberships,
      activeChurchId,
      activeChurch: activeMembership?.church ?? null,
      role: activeMembership?.role ?? null,
      isAdmin: activeMembership?.role === 'admin',
      selectChurch,
      refresh: loadMemberships,
    }),
    [loading, memberships, activeChurchId, activeMembership, selectChurch, loadMemberships],
  )

  return <ChurchContext.Provider value={value}>{children}</ChurchContext.Provider>
}

export function useChurch() {
  const ctx = useContext(ChurchContext)
  if (!ctx) throw new Error('useChurch debe usarse dentro de <ChurchProvider>')
  return ctx
}
