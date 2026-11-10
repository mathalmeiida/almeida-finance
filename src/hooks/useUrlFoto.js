import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { caminhoFoto } from '../lib/fotoPerfil'

// URL assinada (1 h) da foto do bucket privado 'avatares', com cache em
// memória compartilhado por todos os avatares da tela.
const cache = new Map() // caminho -> { url, expira }
const VALIDADE_S = 3600

export function useUrlFoto(fotoUrl) {
  const caminho = caminhoFoto(fotoUrl)
  const [url, setUrl] = useState(() => {
    const c = caminho && cache.get(caminho)
    return c && c.expira > Date.now() ? c.url : null
  })

  useEffect(() => {
    let ativo = true
    if (!caminho) { setUrl(null); return undefined }
    const c = cache.get(caminho)
    if (c && c.expira > Date.now()) { setUrl(c.url); return undefined }
    setUrl(null)
    supabase.storage.from('avatares').createSignedUrl(caminho, VALIDADE_S).then(({ data, error }) => {
      if (!ativo || error || !data?.signedUrl) return
      cache.set(caminho, { url: data.signedUrl, expira: Date.now() + (VALIDADE_S - 120) * 1000 })
      setUrl(data.signedUrl)
    }, () => {})
    return () => { ativo = false }
  }, [caminho])

  return url
}
