import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CircleHelp, BookOpen, MessageSquarePlus, Headphones,
  ChevronRight, CheckCircle2, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useFeedbacks } from '../../hooks/useFeedbacks'

// ─── Ajuda & Feedback ─────────────────────────────────────────────────────────
// Quatro cards conforme design aprovado:
//  1. Perguntas frequentes (FAQ) — expandível
//  2. Como usar o aplicativo — guia expandível
//  3. Enviar feedback — formulário real (usa useFeedbacks existente)
//  4. Suporte — contato
// ─────────────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Como funciona o limite diário?',
    r: 'O limite diário é calculado automaticamente a partir do seu saldo seguro (após descontar compromissos até a próxima receita e a reserva de emergência), dividido pelos dias restantes do período. Você também pode definir um valor manual.',
  },
  {
    q: 'O que é saldo seguro?',
    r: 'Saldo seguro = saldo atual − despesas, faturas e parcelas com vencimento antes da sua próxima receita. Representa o dinheiro disponível sem comprometer contas futuras.',
  },
  {
    q: 'Os dados financeiros são privados?',
    r: 'Sim. Seus dados são protegidos por políticas de segurança (RLS) no banco de dados. Nenhum usuário tem acesso aos dados de outro, a menos que você autorize explicitamente uma consultoria.',
  },
  {
    q: 'Como adicionar um cartão de crédito?',
    r: 'Acesse a seção Cartões no menu lateral ou pelo atalho "Cartões e Faturas" em Todas as Funcionalidades. Informe o nome, banco, limite, dia de fechamento e vencimento.',
  },
  {
    q: 'Posso usar o app offline?',
    r: 'O Almeida Finance é um PWA (Progressive Web App). Algumas telas podem ser acessadas offline, mas os dados financeiros exigem conexão para sincronizar com o banco de dados.',
  },
  {
    q: 'Como funciona o modo Consultoria?',
    r: 'Um consultor autorizado pode visualizar seus dados em modo somente leitura. Você concede e revoga o acesso a qualquer momento em Configurações → Acessos de consultoria.',
  },
]

const GUIA = [
  { titulo: 'Configurar o app', desc: 'Abra o menu Mais → vá em Configurações e escolha aparência, notificações e preferências financeiras.' },
  { titulo: 'Registrar um gasto', desc: 'Toque no botão "+" na barra inferior → Despesa. Preencha valor, categoria e forma de pagamento.' },
  { titulo: 'Simular uma compra', desc: 'Acesse "Simular Compra (E Se)" em Todas as Funcionalidades para ver o impacto no seu orçamento antes de comprar.' },
  { titulo: 'Acompanhar investimentos', desc: 'Acesse Investimentos para registrar aportes, resgates e visualizar rentabilidade e proventos.' },
  { titulo: 'Criar metas financeiras', desc: 'Acesse Metas para definir objetivos, vincular investimentos e acompanhar o progresso mensal.' },
]

const TIPOS = [
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'duvida',   label: 'Dúvida' },
  { value: 'problema', label: 'Problema' },
]

export default function AjudaFeedback() {
  const navigate = useNavigate()
  const { criar } = useFeedbacks()

  const [faqAberta, setFaqAberta] = useState(null)
  const [guiaAberto, setGuiaAberto] = useState(null)
  const [feedbackAberto, setFeedbackAberto] = useState(false)

  // Formulário de feedback
  const [tipo, setTipo] = useState('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')

  async function handleEnviar(e) {
    e.preventDefault()
    if (!mensagem.trim() || enviando) return
    setEnviando(true); setErroEnvio('')
    try {
      await criar({ tipo, mensagem })
      setEnviado(true)
      setMensagem(''); setTipo('sugestao')
      setTimeout(() => { setEnviado(false); setFeedbackAberto(false) }, 3000)
    } catch {
      setErroEnvio('Não foi possível enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const cardCls = 'card divide-y divide-gray-100 !p-0 overflow-hidden'
  const linhaBtn = 'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50'

  return (
    <div className="min-h-[100dvh] bg-gray-50 -mx-4 -mt-1">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white border-b border-gray-100 px-4 h-14"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => navigate(-1)} aria-label="Voltar"
          className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1 text-center">Ajuda &amp; feedback</h1>
        <span className="w-9" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* ── 1. FAQ ────────────────────────────────────────────────────── */}
        <section>
          <div className={cardCls}>
            <button type="button" onClick={() => setFaqAberta(v => v === 'faq' ? null : 'faq')}
              className={linhaBtn}>
              <span className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <CircleHelp size={20} className="text-violet-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Perguntas frequentes (FAQ)</p>
                <p className="text-xs text-gray-500">Respostas para as principais dúvidas</p>
              </div>
              {faqAberta === 'faq'
                ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
            </button>

            {faqAberta === 'faq' && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {FAQ.map((item, i) => (
                  <div key={i} className="px-4">
                    <button type="button"
                      onClick={() => setFaqAberta(v => v === `faq-${i}` ? 'faq' : `faq-${i}`)}
                      className="flex w-full items-center justify-between gap-2 py-3 text-left">
                      <p className="text-sm font-medium text-gray-800">{item.q}</p>
                      {faqAberta === `faq-${i}`
                        ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                        : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                    </button>
                    {faqAberta === `faq-${i}` && (
                      <p className="text-xs text-gray-600 pb-3 leading-relaxed">{item.r}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── 2. Como usar ─────────────────────────────────────────────── */}
        <section>
          <div className={cardCls}>
            <button type="button" onClick={() => setGuiaAberto(v => v === 'guia' ? null : 'guia')}
              className={linhaBtn}>
              <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} className="text-blue-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Como usar o aplicativo</p>
                <p className="text-xs text-gray-500">Guias e tutoriais passo a passo</p>
              </div>
              {guiaAberto === 'guia'
                ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
            </button>

            {guiaAberto === 'guia' && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {GUIA.map((item, i) => (
                  <div key={i} className="px-4">
                    <button type="button"
                      onClick={() => setGuiaAberto(v => v === `g-${i}` ? 'guia' : `g-${i}`)}
                      className="flex w-full items-center justify-between gap-2 py-3 text-left">
                      <p className="text-sm font-medium text-gray-800">{item.titulo}</p>
                      {guiaAberto === `g-${i}`
                        ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                        : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                    </button>
                    {guiaAberto === `g-${i}` && (
                      <p className="text-xs text-gray-600 pb-3 leading-relaxed">{item.desc}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── 3. Enviar feedback ───────────────────────────────────────── */}
        <section>
          <div className={cardCls}>
            <button type="button" onClick={() => setFeedbackAberto(v => !v)}
              className={linhaBtn}>
              <span className="w-10 h-10 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
                <MessageSquarePlus size={20} className="text-marca" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Enviar feedback</p>
                <p className="text-xs text-gray-500">Sugestões, elogios ou problemas</p>
              </div>
              {feedbackAberto
                ? <X size={16} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
            </button>

            {feedbackAberto && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                {enviado ? (
                  <div className="flex items-center gap-2 py-2">
                    <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700 font-medium">Feedback enviado com sucesso! Obrigado.</p>
                  </div>
                ) : (
                  <form onSubmit={handleEnviar} className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {TIPOS.map(t => (
                        <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                          className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                            tipo === t.value ? 'bg-marca text-white border-marca' : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="input min-h-[80px] resize-y text-sm"
                      placeholder="Escreva sua mensagem aqui..."
                      value={mensagem}
                      onChange={e => setMensagem(e.target.value)}
                      maxLength={2000}
                    />
                    {erroEnvio && <p className="text-xs text-red-500">{erroEnvio}</p>}
                    <button type="submit" disabled={enviando || !mensagem.trim()}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                      {enviando ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : 'Enviar'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── 4. Suporte ───────────────────────────────────────────────── */}
        <section>
          <div className={cardCls}>
            <div className={linhaBtn + ' cursor-default'}>
              <span className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
                <Headphones size={20} className="text-cyan-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Suporte</p>
                <p className="text-xs text-gray-500">Fale com o time do Almeida Finance</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 leading-relaxed">
                Para suporte direto, use a opção <strong className="text-gray-700">Enviar feedback</strong> acima
                com o tipo <em>"Problema"</em>. Nossa equipe analisa todos os envios e retorna pelo e-mail da conta.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
