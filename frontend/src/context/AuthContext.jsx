import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { api } from '../lib/apiClient.js'
import { usernameToEmail } from '../lib/username.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
  }, [])

  // Carga el perfil (usuario visible + si es admin del sistema) desde el backend.
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    let active = true
    api
      .get('/auth/me')
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch(() => {
        if (active) setProfile(null)
      })
    return () => {
      active = false
    }
  }, [user])

  const value = useMemo(
    () => ({
      user,
      profile,
      isSystemAdmin: !!profile?.isSystemAdmin,
      loading,
      signIn: async (usuario, password) => {
        try {
          await signInWithEmailAndPassword(auth, usernameToEmail(usuario), password)
          return { error: null }
        } catch (err) {
          return { error: err }
        }
      },
      signOut: () => firebaseSignOut(auth),
    }),
    [user, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
