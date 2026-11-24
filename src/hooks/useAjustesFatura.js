import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { creditoVigente } from '../lib/historicoFatura'

// Leitura da razão ajustes_fatura (somente SELECT; a escrita é feita só pelo banco).
// Filtra por cartão e, opcionalmente, por competência ('YYYY-MM').
export function useAjustesFatura(cartaoId, anoMes = null) {
  const { idEfetivo } = useAuth()
  const [ajustes, setAjustes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo || !cartaoId) return
    setCarregando(true); setErro(null)
    try {
      let query = supabase
        .from('ajustes_fatura')
        .select('*')
        .eq('usuario_id', idEfetivo)
        .eq('cartao_id', cartaoId)
        .order('criado_em', { ascending: false })
      if (anoMes) query = query.eq('ano_mes', anoMes)
      const { data, error } = await query
      if (error) throw error
      setAjustes(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo, cartaoId, anoMes])

  useEffect(() => { buscar() }, [buscar])

  return { ajustes, credito: creditoVigente(ajustes), carregando, erro, recarregar: buscar }
}
