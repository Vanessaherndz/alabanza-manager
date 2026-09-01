import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente efímero para "aprovisionar" cuentas: al llamar signUp, supabase-js
// deja la sesión del usuario recién creado en el cliente que hizo la llamada.
// Con este cliente aparte (persistSession: false) el administrador que está
// usando la app NO pierde su sesión.
export function makeProvisioningClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'alabanza-provisioning',
    },
  })
}
