import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { makeProvisioningClient } from '../lib/adminClient.js'
import { loginToEmail, normalizeUsername, usernameToEmail } from '../lib/username.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Carga el perfil (usuario visible + si es admin del sistema)
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    let active = true
    supabase
      .from('profiles')
      .select('id, username, full_name, phone, is_system_admin')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (active) setProfile(data ?? null)
      })
    return () => {
      active = false
    }
  }, [session?.user?.id])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isSystemAdmin: !!profile?.is_system_admin,
      loading,
      signIn: (usuario, password) =>
        supabase.auth.signInWithPassword({
          email: loginToEmail(usuario),
          password,
        }),
      // Crea una cuenta nueva SIN cerrar la sesión del administrador actual.
      // Devuelve { userId, error }.
      createAccount: async ({ username, password, fullName, phone }) => {
        const client = makeProvisioningClient()
        const { data, error } = await client.auth.signUp({
          email: usernameToEmail(username),
          password,
          options: {
            data: {
              username: normalizeUsername(username),
              full_name: fullName?.trim() || normalizeUsername(username),
              phone: phone?.trim() || null,
            },
          },
        })
        return { userId: data?.user?.id ?? null, error }
      },
      signOut: () => supabase.auth.signOut(),
    }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
