import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Send, ArrowLeft, Check, X, Edit2, TestTube, Info } from 'lucide-react'
import { parseWhatsAppMessage, formatarValor, rotuloCategoria } from '../../lib/whatsappParser'

import { useAuth } from '../../contexts/AuthContext'
import { useReceitas } from '../../hooks/useReceitas'
import { useDespesas } from '../../hooks/useDespesas'
import { supabase } from '../../lib/supabase'
import { classificarDespesa } from '../../lib/classificarDespesa'
import { hojeISO } from '../../lib/utils'

const DEV_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const exemplos = ['Recebi 3000 de salário','Gastei R$ 150 no mercado','Paguei 50 de luz ontem','Comprei notebook R$ 2400 em 12x no crédito','Gastei R$ 35 no Uber via pix']
const categorias = ['salario','renda_extra','investimentos','alimentacao','transporte','saude','lazer','educacao','moradia','telecomunicacoes','vestuario','assinaturas','outros']
const pagamentos = {pix:'Pix',dinheiro:'Dinheiro',cartao_credito:'Cartão de crédito',cartao_debito:'Cartão de débito',boleto:'Boleto'}
export default function AdminWhatsApp() {
  const { usuario, ehAdmin, modoConsultoria, somenteLeitura } = useAuth()
  const receitas = useReceitas()
  const despesas = useDespesas()
  const [real,setReal] = useState(false)
  const [salvando,setSalvando] = useState(false)
  const [cats,setCats] = useState([])
  const [catId,setCatId] = useState('')
  const [pagamento,setPagamento] = useState('')
  const trava = useRef(false)
  const permitido = !!usuario?.id && ehAdmin === true && !modoConsultoria && !somenteLeitura && String(supabase.supabaseUrl || '').replace(/\/$/,'') === DEV_URL
  useEffect(()=>{
    setReal(false); setCats([]); setCatId(''); setPreview(null); setEdicao(null)
    if(!permitido) return
    let ativo=true
    supabase.from('categorias').select('id,nome,usuario_id').eq('tipo','despesa').or(`usuario_id.is.null,usuario_id.eq.${usuario.id}`).order('nome').then(({data,error})=>{if(ativo&&!error)setCats(data||[])})
    return ()=>{ativo=false}
  },[permitido,usuario?.id])
  const [texto,setTexto]=useState('')
  const [mensagens,setMensagens]=useState([])
  const [preview,setPreview]=useState(null)
  const [edicao,setEdicao]=useState(null)
  const [erro,setErro]=useState('')
  const fim=useRef(null), campo=useRef(null), sequencia=useRef(0)
  useEffect(()=>{fim.current?.scrollIntoView({block:'nearest'})},[mensagens,preview,edicao])
  const adicionar=(tipo,conteudo)=>setMensagens(prev=>[...prev,{id:++sequencia.current,tipo,conteudo,hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})}])
  function enviar(e){
    e.preventDefault(); if(preview||!texto.trim())return;
    adicionar('usuario',texto.trim()); const r=parseWhatsAppMessage(texto);setTexto('');setErro('');
    if(!r.sucesso){adicionar('erro',r.erro);return;} setPreview({...r.transacao, id:crypto.randomUUID(), dono:usuario?.id});setCatId('');setPagamento(r.transacao.forma_pagamento||'')
  }
  async function concluir(confirmado){
    if(!preview || trava.current || edicao)return;
    if(!confirmado){adicionar('sistema','Lançamento cancelado.');setPreview(null);setErro('');return;}
    if(!real){adicionar('sistema',`✓ Simulação concluída\n${preview.descricao}\nValor: ${formatarValor(preview.valor)}\nNenhum lançamento foi gravado.`);setPreview(null);setErro('');return;}
    if(!permitido || preview.dono!==usuario.id){setErro('Gravação permitida somente ao administrador no DEV.');return;}
    if(preview.familiar || preview.parcelas || preview.forma_pagamento==='cartao_credito' || /\b(vr|va|vale|benef[ií]cio|cart[aã]o)\b/i.test(preview.descricao)){setErro('Use o módulo correspondente para cartão, benefícios, parcelas ou família.');return;}
    if(!Number.isFinite(preview.valor)||preview.valor<=0||preview.valor>999999999||Math.abs(preview.valor*100-Math.round(preview.valor*100))>0.00001||!preview.descricao.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(preview.data)||preview.data>hojeISO()){setErro('Revise valor, descrição e data (não futura).');return;}
    const dt=new Date(preview.data+'T12:00:00Z');
    if(!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==preview.data){setErro('Data inválida.');return;}
    const cat=cats.find(c=>c.id===catId);
    if(preview.tipo==='despesa'&&(!cat||!['pix','dinheiro','cartao_debito','boleto'].includes(pagamento))){setErro('Selecione uma categoria cadastrada e a forma de pagamento.');return;}
    trava.current=true;setSalvando(true);setErro('');
    const tabela=preview.tipo==='receita'?'receitas':'despesas';
    const base={id:preview.id,descricao:preview.descricao.trim(),valor:preview.valor,data:preview.data,frequencia:'nao_repete',recorrente:false};
    const payload=preview.tipo==='receita'?{...base,categoria:rotuloCategoria(preview.categoria)}:{...base,categoria_id:cat.id,forma_pagamento:pagamento,tipo_despesa:classificarDespesa({descricao:base.descricao,categoria:cat.nome})};
    try {
      const {data:existente,error:consultaErro}=await supabase.from(tabela).select('id').eq('id',base.id).eq('usuario_id',usuario.id).maybeSingle();
      if(consultaErro)throw consultaErro;
      if(!existente)await (preview.tipo==='receita'?receitas.criar(payload):despesas.criar(payload));
      adicionar('sistema',`✓ Lançamento confirmado no DEV\n${base.descricao} — ${formatarValor(base.valor)}`);setPreview(null);
    } catch(err){
      try{const {data,error}=await supabase.from(tabela).select('id').eq('id',base.id).eq('usuario_id',usuario.id).maybeSingle();if(!error&&data){adicionar('sistema','Lançamento localizado no DEV. Não será duplicado.');setPreview(null);return;}}catch{}
      setErro('Não foi possível confirmar a gravação: '+(err.message||'erro desconhecido')+'. Uma nova tentativa mantém o mesmo identificador.');
    }finally{trava.current=false;setSalvando(false);}
  }
  function salvarEdicao(e){
    e.preventDefault(); const valor=Number(edicao.valor);
    if(!edicao.descricao.trim()||!Number.isFinite(valor)||valor<=0||valor>999999999||Math.abs(valor*100-Math.round(valor*100))>0.00001||!edicao.data){setErro('Revise a descrição, o valor e a data.');return;}
    setPreview({...edicao,valor,descricao:edicao.descricao.trim()});setEdicao(null);setErro('');
  }
  const linha=(nome,valor)=><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-gray-500">{nome}</span><strong className="text-gray-800 break-words">{valor}</strong></div>
  return <div className="min-h-[100dvh] flex flex-col bg-gray-50">
    <header className="bg-marca text-white shrink-0"><div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3"><Link to="/admin" aria-label="Voltar" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft size={20}/></Link><MessageSquare size={24}/><div className="flex-1 min-w-0"><h1 className="font-bold text-lg">WhatsApp Financeiro</h1><p className="text-xs text-white/80">Assistente financeiro • ambiente de testes</p></div><span className="flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-2 text-xs"><TestTube size={15}/> {real ? "Gravação DEV" : "Simulação"}</span></div></header>
    <div className="max-w-4xl w-full mx-auto px-4 pt-4"><div className="rounded-xl bg-marca-100 text-marca p-3 flex gap-2 text-sm"><Info size={18} className="shrink-0"/><span>{real ? "Atenção: confirmações gravam lançamentos no banco DEV. Nenhuma mensagem é enviada à Meta." : "Simulação: nenhum lançamento será gravado. A integração com a Meta continua desativada."}</span></div>{permitido?<label className="flex items-center gap-2 py-3 text-sm font-semibold"><input type="checkbox" checked={real} disabled={!!preview||salvando} onChange={e=>setReal(e.target.checked)}/> Habilitar gravação de teste no DEV</label>:<p className="text-xs text-gray-500 py-2">Gravação bloqueada fora do DEV ou sem permissão administrativa.</p>}</div>
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 space-y-4" aria-live="polite">
      {!mensagens.length && <div className="card space-y-3"><h2 className="font-bold text-gray-900">Como posso ajudar?</h2><p className="text-sm text-gray-500">Digite uma receita ou despesa, ou escolha um exemplo.</p><div className="grid sm:grid-cols-2 gap-2">{exemplos.map(ex=><button key={ex} type="button" onClick={()=>{setTexto(ex);campo.current?.focus()}} className="text-left border border-gray-200 rounded-xl p-3 text-sm text-gray-700 hover:border-marca">{ex}</button>)}</div></div>}
      {mensagens.map(m=><div key={m.id} className={`flex ${m.tipo==='usuario'?'justify-end':'justify-start'}`}><div className={`max-w-[90%] rounded-2xl p-3.5 shadow-sm ${m.tipo==='usuario'?'bg-marca text-white':m.tipo==='erro'?'bg-red-50 text-red-800 border border-red-200':'bg-white text-gray-800 border border-gray-200'}`}><p className="whitespace-pre-wrap break-words text-sm">{m.conteudo}</p><p className="text-[11px] opacity-70 text-right mt-1">{m.hora}</p></div></div>)}
      {preview && <section className="card max-w-lg space-y-4"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold text-marca">{preview.tipo==='receita'?'Receita identificada':'Despesa identificada'}</h2>{!edicao&&<button disabled={salvando} type="button" onClick={()=>setEdicao({...preview})} aria-label="Editar" className="p-2 text-marca"><Edit2 size={18}/></button>}</div>
      {edicao?<form onSubmit={salvarEdicao} className="space-y-3">
        <label className="block text-sm">Descrição<input className="input" required value={edicao.descricao} onChange={e=>setEdicao({...edicao,descricao:e.target.value})}/></label>
        <label className="block text-sm">Valor (R$)<input className="input" type="number" min="0.01" step="0.01" required value={edicao.valor} onChange={e=>setEdicao({...edicao,valor:e.target.value})}/></label>
        <label className="block text-sm">Categoria<select className="input" value={edicao.categoria} onChange={e=>setEdicao({...edicao,categoria:e.target.value})}>{categorias.filter(c=>c==='outros'||(edicao.tipo==='receita'?['salario','renda_extra','investimentos'].includes(c):!['salario','renda_extra','investimentos'].includes(c))).map(c=><option key={c} value={c}>{rotuloCategoria(c)}</option>)}</select></label>
        <label className="block text-sm">Data<input className="input" type="date" required value={edicao.data} onChange={e=>setEdicao({...edicao,data:e.target.value})}/></label>
        {erro&&<p role="alert" className="text-red-600 text-sm">{erro}</p>}<div className="flex gap-2"><button className="btn-primary flex-1" type="submit">Salvar edição</button><button className="btn-secondary" type="button" onClick={()=>{setEdicao(null);setErro('')}}>Voltar</button></div>
      </form>:<><p className={`text-3xl font-bold tabular-nums ${preview.tipo==='receita'?'text-green-600':'text-marca'}`}>{formatarValor(preview.valor)}</p><div className="space-y-2">{linha('Descrição',preview.descricao)}{linha('Categoria',rotuloCategoria(preview.categoria))}{linha('Data',preview.data.split('-').reverse().join('/'))}{linha('Pagamento',pagamentos[preview.forma_pagamento]||'Não informado')}{preview.parcelas&&linha('Parcelamento',`${preview.parcelas}x • valor total informado`)}{preview.familiar&&linha('Familiar','Sim')}</div>{real&&preview.tipo==='despesa'&&<div className="space-y-2"><label className="block text-sm">Categoria cadastrada<select className="input" value={catId} disabled={salvando} onChange={e=>setCatId(e.target.value)}><option value="">Selecione</option>{cats.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><label className="block text-sm">Forma de pagamento<select className="input" disabled={salvando} value={pagamento} onChange={e=>setPagamento(e.target.value)}><option value="">Selecione</option>{Object.entries(pagamentos).filter(([k])=>k!=='cartao_credito').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>}{erro&&<p role="alert" className="text-red-600 text-sm">{erro}</p>}<p className="text-sm text-gray-500">{real?'Confirme para gravar no banco DEV.':'Confira os dados antes de confirmar a simulação.'}</p><div className="flex gap-2"><button type="button" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={salvando} onClick={()=>concluir(true)}><Check size={18}/> {salvando?"Salvando...":real?"Gravar no DEV":"Confirmar simulação"}</button><button type="button" className="btn-secondary flex items-center gap-1" disabled={salvando} onClick={()=>concluir(false)}><X size={16}/> Cancelar</button></div></>}
      </section>}
      <div ref={fim}/>
    </main>
    <footer className="sticky bottom-0 bg-white border-t border-gray-200 p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><form onSubmit={enviar} className="max-w-4xl mx-auto flex gap-2"><input ref={campo} className="input flex-1 min-w-0" aria-label="Mensagem financeira" placeholder="Digite sua mensagem financeira..." value={texto} maxLength={500} disabled={!!preview} onChange={e=>setTexto(e.target.value)}/><button type="submit" disabled={!!preview||!texto.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50"><Send size={18}/><span className="hidden sm:inline">Enviar</span></button></form></footer>
  </div>
}
