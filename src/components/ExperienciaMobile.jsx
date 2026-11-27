import React,{useEffect,useState} from 'react'
import {Smartphone,Bell,Sun,Moon,CheckCircle2,ChevronDown} from 'lucide-react'
import {useAuth} from '../contexts/AuthContext'
import {supabase} from '../lib/supabase'
import {usePushNotificacoes} from '../hooks/usePushNotificacoes'

let promptInstalacao = null
if(typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstalacao=e})
  window.addEventListener('appinstalled',()=>{promptInstalacao=null;window.dispatchEvent(new Event('af-instalado'))})
}
export default function ExperienciaMobile(){
  const {usuario,modoConsultoria}=useAuth(), uid=usuario?.id
  const p=usePushNotificacoes()
  const [instalado,setInstalado]=useState(p.instalado),[aberto,setAberto]=useState(false),[erro,setErro]=useState('')
  const mobile=p.plataforma!=='desktop'
  useEffect(()=>{
    if(!uid || !mobile || modoConsultoria)return
    let vivo=true
    const registrar=async()=>{
      const detectado=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true
      if(vivo && detectado)setInstalado(true)
      if(detectado) await supabase.from('af_push_instalacoes').upsert({usuario_id:uid,plataforma:p.plataforma,ultimo_uso:new Date().toISOString()},{onConflict:'usuario_id,plataforma'})
    }
    registrar().catch(()=>{})
    const atualizar=()=>registrar().catch(()=>{})
    const eventoInstalado=()=>{setInstalado(true);supabase.from('af_push_instalacoes').upsert({usuario_id:uid,plataforma:p.plataforma,ultimo_uso:new Date().toISOString()},{onConflict:'usuario_id,plataforma'}).then(()=>{})}
    window.addEventListener('focus',atualizar);window.addEventListener('af-instalado',eventoInstalado)
    try{setAberto(!localStorage.getItem('af-experiencia-v1:'+uid))}catch{setAberto(true)}
    return()=>{vivo=false;window.removeEventListener('focus',atualizar);window.removeEventListener('af-instalado',eventoInstalado)}
  },[uid,mobile,modoConsultoria,p.plataforma])
  function fechar(){setAberto(false);try{localStorage.setItem('af-experiencia-v1:'+uid,'1')}catch{}}
  async function instalar(){
    setErro('')
    if(promptInstalacao){const e=promptInstalacao;promptInstalacao=null;try{await e.prompt();await e.userChoice}catch{setErro('Use o menu do navegador para instalar.')}}
  }
  if(!uid || !mobile || modoConsultoria || p.verificando || (instalado && p.ativado))return null
  return <section className="card my-3 space-y-3" aria-label="Complete sua experiência">
    <button type="button" onClick={()=>aberto?fechar():setAberto(true)} aria-expanded={aberto} className="w-full flex items-center gap-3 text-left"><Smartphone className="text-marca shrink-0" size={24}/><span className="flex-1"><strong>Complete sua experiência</strong><span className="block text-xs text-gray-500">{Number(instalado)+Number(p.ativado)} de 2 configurações</span></span><ChevronDown size={18} className={aberto?'rotate-180':''}/></button>
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-marca" style={{width:`${(Number(instalado)+Number(p.ativado))*50}%`}}/></div>
    {aberto && <><div className="rounded-xl border border-gray-200 p-3 space-y-2"><p className="font-semibold flex items-center gap-2">{instalado?<CheckCircle2 className="text-green-600" size={20}/>:<Smartphone className="text-marca" size={20}/>} 1. Adicionar à tela inicial</p>{instalado?<p className="text-sm text-gray-500">Instalação detectada.</p>:<><p className="text-sm text-gray-600">Abra suas finanças com um toque, como um aplicativo.</p>{p.ehiOS?<p className="text-sm">No Safari, toque em Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone.</p>:<><button className="btn-primary w-full" onClick={instalar}>Instalar aplicativo</button><p className="text-xs text-gray-500">Se não abrir a instalação, use o menu do navegador → Instalar aplicativo ou Adicionar à tela inicial.</p></>}</>}</div>
    <div className="rounded-xl border border-gray-200 p-3 space-y-3"><p className="font-semibold flex gap-2 items-center">{p.ativado?<CheckCircle2 size={20} className="text-green-600"/>:<Bell size={20} className="text-marca"/>} 2. Ativar notificações</p><p className="text-sm flex gap-2 items-center"><Sun size={18}/> 08h — Quanto posso gastar hoje?</p><p className="text-sm flex gap-2 items-center"><Moon size={18}/> 21h — Registre suas movimentações</p><p className="text-xs text-gray-500">Horário de Brasília. Apenas dois lembretes por dia, sem propagandas.</p>{!p.ativado && <button className="btn-primary w-full disabled:opacity-50" disabled={!p.suportado || p.carregando || p.permissao==='denied'} onClick={()=>p.ativar().catch(()=>{})}>{p.carregando?'Ativando…':'Ativar notificações'}</button>}{p.ehiOS&&!p.instalado&&<p className="text-xs">Abra pelo ícone instalado para ativar.</p>}{p.permissao==='denied'&&<p className="text-xs">Libere as notificações do Almeida Finance nos ajustes do aparelho.</p>}{!p.suportado&&(!p.ehiOS||p.instalado)&&<p className="text-xs">Este navegador ou sistema ainda não suporta notificações push.</p>}{(p.erro||erro)&&<p role="alert" className="text-xs text-red-600">{p.erro||erro}</p>}</div><button className="w-full text-sm text-gray-500 py-2" onClick={fechar}>Configurar mais tarde</button></>}
  </section>
}
