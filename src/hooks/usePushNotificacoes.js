import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function detectarPlataforma() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  return /android/i.test(navigator.userAgent) ? 'android' : 'desktop'
}
export function detectarInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}
function bytes(key) {
  return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-key.length%4)%4)), c => c.charCodeAt(0))
}
async function registro() {
  await navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'})
  return navigator.serviceWorker.ready
}
export async function cancelarPushNesteDispositivo(uid) {
  if (!uid || !('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager?.getSubscription()
  if (!sub) return
  const {error} = await supabase.from('push_subscriptions').update({ativo:false,af_diario:false}).eq('usuario_id',uid).eq('endpoint',sub.endpoint)
  // Mesmo se o banco estiver offline, invalida a inscrição no navegador.
  const cancelado = await sub.unsubscribe()
  if (error && !cancelado) throw error
}
export function usePushNotificacoes() {
  const {usuario, modoConsultoria} = useAuth()
  const uid = usuario?.id
  const plataforma = detectarPlataforma(), ehiOS = plataforma === 'ios', instalado = detectarInstalado()
  const suportado = plataforma !== 'desktop' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && (!ehiOS || instalado)
  const [permissao,setPermissao] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [ativado,setAtivado] = useState(false), [carregando,setCarregando] = useState(false), [verificando,setVerificando] = useState(true)
  const [erro,setErro] = useState(null), [chave,setChave] = useState('')
  useEffect(() => {
    let vivo = true
    async function verificar() {
      if (!vivo) return
      setVerificando(true); setAtivado(false)
      setPermissao(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
      try {
        if (!uid || modoConsultoria) return
        const {data:k,error:e} = await supabase.from('af_push_config').select('public_key').eq('id',1).maybeSingle()
        if(e) throw e
        if(vivo) setChave(k?.public_key || '')
        if(!suportado || Notification.permission !== 'granted' || !k?.public_key) return
        const reg = await registro(), sub = await reg.pushManager.getSubscription()
        if(!sub) return
        const {data,error} = await supabase.from('push_subscriptions').select('ativo,af_diario').eq('usuario_id',uid).eq('endpoint',sub.endpoint).maybeSingle()
        if(error) throw error
        const atual = sub.options.applicationServerKey
        const igual = atual && String(new Uint8Array(atual)) === String(bytes(k.public_key))
        if(vivo) setAtivado(!!(data?.ativo && data?.af_diario && igual))
      } catch { if(vivo) setAtivado(false) }
      finally { if(vivo) setVerificando(false) }
    }
    verificar()
    window.addEventListener('focus',verificar)
    window.addEventListener('af-push-alterado',verificar)
    return () => { vivo=false; window.removeEventListener('focus',verificar); window.removeEventListener('af-push-alterado',verificar) }
  },[uid,modoConsultoria,suportado])
  const ativar = useCallback(async () => {
    if(!uid || modoConsultoria || !suportado || carregando) return
    setCarregando(true); setErro(null)
    try {
      if(!chave) throw new Error('Notificações ainda não configuradas no servidor. Tente novamente mais tarde.')
      // A permissão precisa ser pedida diretamente no clique, antes de awaits de rede.
      const p = await Notification.requestPermission(); setPermissao(p)
      if(p !== 'granted') throw new Error('Autorize as notificações nas configurações do dispositivo.')
      const reg = await registro(); let sub = await reg.pushManager.getSubscription()
      if(sub && (!sub.options.applicationServerKey || String(new Uint8Array(sub.options.applicationServerKey)) !== String(bytes(chave)))) { await sub.unsubscribe(); sub=null }
      if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(chave)})
      const salvar = async () => supabase.from('push_subscriptions').upsert({usuario_id:uid,endpoint:sub.endpoint,subscription:sub.toJSON(),plataforma,ativo:true,af_diario:true,atualizado_em:new Date().toISOString()},{onConflict:'endpoint'})
      let {error}=await salvar()
      // Endpoint de outra conta não pode ser transferido por upsert. Cria nova inscrição.
      if(error?.code === '42501' || error?.code === '23505') { await sub.unsubscribe(); sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(chave)}); ({error}=await salvar()) }
      if(error) throw error
      setAtivado(true); window.dispatchEvent(new Event('af-push-alterado'))
    } catch(e) { setAtivado(false); setErro(e.message); throw e }
    finally {setCarregando(false)}
  },[uid,modoConsultoria,suportado,carregando,chave,plataforma])
  const desativar = useCallback(async () => {
    if(!uid || modoConsultoria) return
    setCarregando(true); setErro(null)
    try { await cancelarPushNesteDispositivo(uid); setAtivado(false); window.dispatchEvent(new Event('af-push-alterado')) }
    catch(e){setErro(e.message)} finally{setCarregando(false)}
  },[uid,modoConsultoria])
  return {suportado,ativado,permissao,carregando,verificando,erro,ehiOS,instalado,plataforma,ativar,desativar}
}
