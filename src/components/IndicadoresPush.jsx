import React,{useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
export default function IndicadoresPush(){
 const [dados,setDados]=useState(null),[erro,setErro]=useState(false)
 useEffect(()=>{let vivo=true;supabase.rpc('af_push_indicadores').then(({data,error})=>{if(vivo){setDados(data);setErro(!!error)}}).catch(()=>{if(vivo)setErro(true)});return()=>{vivo=false}},[])
 return <section className="card space-y-3"><h2 className="font-semibold">Engajamento dos clientes</h2>{erro?<p className="text-sm text-gray-500">Indicadores ainda indisponíveis.</p>:!dados?<p className="text-sm">Carregando…</p>:<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['Instalações detectadas',dados.instalados],['Notificações inscritas',dados.notificacoes],['Configuração completa',dados.completos],['Ativos hoje (login)',dados.ativos_hoje]].map(([label,n])=><div key={label} className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold text-marca">{n}</p><p className="text-xs text-gray-500">{dados.total>0?Math.round(n*100/dados.total):0}% dos perfis ativos</p></div>)}</div>}<p className="text-xs text-gray-500">Instalações são estimadas por abertura do PWA; inscrição não garante entrega. Atividade considera o último login registrado.</p></section>
}
