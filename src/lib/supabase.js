import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente do Supabase não encontradas. ' +
    'Verifique se o arquivo .env.local contém VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persiste a sessão no localStorage para que o login continue após fechar o navegador
    persistSession: true,
    // Renova o token automaticamente antes de expirar
    autoRefreshToken: true,
    // Detecta a sessão na URL (necessário para confirmação de e-mail, se ativada)
    detectSessionInUrl: true,
  },
})
