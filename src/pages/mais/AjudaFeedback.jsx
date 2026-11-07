import React, { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, MessageSquarePlus, CircleHelp, BookOpen } from 'lucide-react'
import { useFeedbacks } from '../../hooks/useFeedbacks'
import { useAuth } from '../../contexts/AuthContext'
import PaginaInterna from '../../components/PaginaInterna'

// ─── Ajuda & Feedback ─────────────────────────────────────────────────────────
// FAQ + explicação das funcionalidades + formulário de feedback REAL.
// Destino do feedback: tabela public.feedbacks do Supabase (hook useFeedbacks),
// lida pelo administrador no painel Admin. Se a tabela/permissão não estiver
// disponível no projeto, o erro é exibido — nunca simulamos sucesso.

const FAQ = [
  { q: 'Como funciona o limite diário?', r: 'O limite diário é calculado a partir do seu saldo seguro (já descontados os compromissos até a próxima receita e a reserva), dividido pelos dias restantes. Você também pode definir um valor manual.' },
  { q: 'O que é saldo seguro?', r: 'É o saldo atual menos despesas, faturas e parcelas que vencem antes da sua próxima receita: o que você pode usar sem comprometer contas futuras.' },
  { q: 'Meus dados são privados?', r: 'Sim. Cada usuário acessa apenas os próprios dados (regras de segurança no banco). Um consultor só vê suas informações, em modo somente leitura, se você autorizar.' },
  { q: 'Como adiciono um cartão de crédito?', r: 'Abra Cartões e informe nome, limite, dia de fechamento e vencimento. As compras no cartão alimentam as faturas.' },
  { q: 'Como escondo os valores na tela?', r: 'Use o ícone de olho na Home ou a opção "Ocultar valores" em Configurações. A escolha fica salva neste dispositivo.' },
  { q: 'Como altero o tema?', r: 'Em Configurações → Aparência escolha Claro, Escuro ou Automático. A preferência é salva e restaurada ao entrar novamente.' },
  { q: 'Como funciona a Consultoria?', r: 'Você pode autorizar ou recusar solicitações de consultoria e revogar o acesso a qualquer momento em Configurações.' },
]

const FUNCIONALIDADES = [
  { t: 'Início e calendário', d: 'Veja saldo, limite do dia, compromissos e o calendário financeiro, e registre gastos rapidamente.' },
  { t: 'Receitas e Despesas', d: 'Cadastre entradas e gastos. Compras parceladas ficam na aba "Parceladas" de Despesas.' },
  { t: 'Cartões', d: 'Controle limites, compras e faturas dos cartões.' },
  { t: 'Benefícios VR/VA', d: 'Acompanhe saldo e gastos dos seus benefícios.' },
  { t: 'Investimentos e Metas', d: 'Registre aportes e resgates e acompanhe objetivos financeiros.' },
  { t: 'Planejamento e Evolução', d: 'Projete os próximos meses e acompanhe a evolução da sua vida financeira.' },
  { t: 'Posso comprar? e E se...?', d: 'Simule o impacto de uma compra ou compare cenários antes de decidir.' },
  { t: 'Consultoria', d: 'Gerencie acessos de consultoria aos seus dados.' },
]

const TIPOS = [
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'duvida', label: 'Dúvida' },
  { value: 'problema', label: 'Problema' },
]
const MIN = 10
const MAX = 2000

function Acordeao({ icone: Icone, titulo, itens, corIcone }) {
  const [aberto, setAberto] = useState(null)
  return (
    <section className="card !p-0 overflow-hidden" aria-label={titulo}>
      <h2 className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-100">
        <Icone size={16} className={corIcone} /> {titulo}
      </h2>
      <ul className="divide-y divide-gray-100">
        {itens.map((it, i) => {
          const ativo = aberto === i
          return (
            <li key={it.q || it.t}>
              <button type="button" aria-expanded={ativo} onClick={() => setAberto(ativo ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span className="min-w-0 text-sm font-medium text-gray-800">{it.q || it.t}</span>
                {ativo ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
              </button>
              {ativo && <p className="px-4 pb-3 text-sm text-gray-600 leading-relaxed">{it.r || it.d}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function AjudaFeedback() {
  const { criar } = useFeedbacks()
  const { somenteLeitura } = useAuth()
  const [tipo, setTipo] = useState('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return
    const texto = mensagem.trim()
    if (texto.length < MIN) { setErro(`Escreva pelo menos ${MIN} caracteres para que possamos entender.`); return }
    setEnviando(true); setErro('')
    try {
      await criar({ tipo, mensagem: texto })
      setEnviado(true); setMensagem(''); setTipo('sugestao')
    } catch (err) {
      setErro(err?.message
        ? `Não foi possível enviar: ${err.message}`
        : 'Não foi possível enviar. Verifique sua conexão e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PaginaInterna titulo="Ajuda & feedback" descricao="Tire dúvidas, conheça os recursos e fale com a gente.">
      <Acordeao icone={CircleHelp} titulo="Perguntas frequentes" itens={FAQ} corIcone="text-violet-600" />
      <Acordeao icone={BookOpen} titulo="Como usar cada funcionalidade" itens={FUNCIONALIDADES} corIcone="text-blue-600" />

      <section className="card" aria-label="Enviar feedback">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
          <MessageSquarePlus size={16} className="text-marca" /> Enviar feedback
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Sua mensagem é gravada na sua conta e analisada pelo administrador do app.
        </p>
        {somenteLeitura ? (
          <p className="text-sm text-gray-600">Indisponível no modo consultoria (somente leitura).</p>
        ) : enviado ? (
          <div className="space-y-3">
            <div role="status" className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-100 p-3">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 font-medium">Feedback enviado com sucesso. Obrigado!</p>
            </div>
            <button type="button" onClick={() => setEnviado(false)} className="btn-secondary text-sm">Enviar outro</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-3" noValidate>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de feedback">
              {TIPOS.map(t => (
                <button key={t.value} type="button" role="radio" aria-checked={tipo === t.value} onClick={() => setTipo(t.value)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${tipo === t.value ? 'bg-marca text-white border-marca' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="fb-msg" className="label">Mensagem</label>
              <textarea id="fb-msg" className="input min-h-[110px] resize-y" placeholder="Descreva sua sugestão, dúvida ou problema..."
                value={mensagem} maxLength={MAX} onChange={e => { setMensagem(e.target.value); if (erro) setErro('') }} />
              <p className="text-[11px] text-gray-400 text-right mt-0.5">{mensagem.trim().length}/{MAX}</p>
            </div>
            {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
            <button type="submit" disabled={enviando}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {enviando ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : 'Enviar feedback'}
            </button>
          </form>
        )}
      </section>
    </PaginaInterna>
  )
}
