import React, { useState, useRef } from 'react'
import {
  MessageCircle, UserCheck, CheckCircle2, Loader2, ArrowDown, Award,
  GraduationCap, BadgeCheck, Wallet, PiggyBank, Target, LineChart, ListChecks, TrendingDown,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useConsultoriaInteresses } from '../hooks/useConsultoria'
import { mascararTelefone, somenteDigitosTelefone, telefoneValido } from '../lib/utils'

// Foto profissional do Matheus, servida da pasta public (/public/images/...).
// O arquivo real é "foto perfil.png" (com espaço); na URL o espaço precisa ser
// %20 para carregar de forma confiável em qualquer navegador/hospedagem.
const fotoMatheus = '/images/foto%20perfil.png'

// Itens de "Como posso ajudar" — ícones discretos, estilo limpo (sem excesso de cor).
const AJUDAS = [
  { icon: Wallet,     titulo: 'Organização das finanças pessoais' },
  { icon: TrendingDown, titulo: 'Controle de gastos' },
  { icon: LineChart,  titulo: 'Planejamento financeiro' },
  { icon: PiggyBank,  titulo: 'Construção de reserva de emergência' },
  { icon: Target,     titulo: 'Organização para grandes objetivos' },
  { icon: ListChecks, titulo: 'Análise do orçamento' },
]

export default function Consultoria() {
  const { usuario, perfil } = useAuth()
  const { interesses, criarInteresse } = useConsultoriaInteresses()

  const nomePadrao = perfil?.nome || usuario?.email?.split('@')[0] || ''
  const [nome, setNome] = useState(nomePadrao)
  const [whatsapp, setWhatsapp] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [registrado, setRegistrado] = useState(false)

  // Âncora da área de solicitação (para o scroll suave do CTA).
  const formRef = useRef(null)
  function irParaConsultoria() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Se o usuário já tem interesse registrado, mostramos o estado de "registrado".
  const jaRegistrou = registrado || interesses.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome.'); return }
    if (!telefoneValido(whatsapp)) { setErro('Informe um WhatsApp válido com DDD.'); return }
    setSalvando(true)
    try {
      await criarInteresse({
        nome: nome.trim(),
        whatsapp: somenteDigitosTelefone(whatsapp),
      })
      setRegistrado(true)
    } catch {
      setErro('Não foi possível registrar seu interesse agora. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── 1. Apresentação profissional ── */}
      <section className="card">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          {/* Foto — no mobile vem primeiro (ordem no DOM); no desktop fica à direita */}
          <div className="md:order-2 md:w-56 flex-shrink-0 flex justify-center">
            {/* object-contain preserva o enquadramento original (não corta a
                cabeça nem deforma). Mobile: centralizada acima do texto.
                Desktop: à direita (md:order-2), tamanho proporcional. */}
            <img
              src={fotoMatheus}
              alt="Matheus Almeida"
              className="w-44 h-auto md:w-full object-contain rounded-2xl"
            />
          </div>

          {/* Texto */}
          <div className="md:order-1 min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Conheça Matheus Almeida</h1>
            <p className="text-sm text-gray-500 mt-1">
              Experiência no mercado financeiro e planejamento financeiro
            </p>

            {/* Apresentação em blocos curtos (leitura rápida no mobile) */}
            <div className="mt-4 space-y-3 text-sm text-gray-700 leading-relaxed">
              <p>
                Minha trajetória profissional foi construída ao longo de mais de 7 anos no mercado
                financeiro, trabalhando diretamente com clientes, planejamento financeiro e
                identificação de soluções para diferentes momentos da vida.
              </p>
              <p>
                Sou Engenheiro de Produção e possuo certificações profissionais da ANBIMA, incluindo
                CPA e C-Pro R, voltadas à qualificação de profissionais que atuam no mercado financeiro
                e no relacionamento com clientes.
              </p>
              <p>
                Ao longo dessa experiência, percebi que muitas pessoas têm uma boa renda, mas ainda
                encontram dificuldades para organizar o dinheiro, controlar os gastos e transformar seus
                objetivos em um planejamento financeiro claro.
              </p>
              <p>
                Foi a partir dessa necessidade que nasceu o Almeida Finance: uma ferramenta criada para
                tornar o controle financeiro mais simples, visual e acessível.
              </p>
              <p>
                Além do aplicativo, quero ajudar de forma mais próxima quem busca organizar melhor sua
                vida financeira e tomar decisões mais conscientes com o próprio dinheiro.
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. Destaques profissionais ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-2.5">
            <Award size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">7+ anos</p>
              <p className="text-xs text-gray-500">Experiência no mercado financeiro</p>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-2.5">
            <GraduationCap size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">Engenharia de Produção</p>
              <p className="text-xs text-gray-500">Formação acadêmica</p>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-2.5">
            <BadgeCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">ANBIMA</p>
              <p className="text-xs text-gray-500">Certificações financeiras: CPA e C-Pro R</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Como posso ajudar ── */}
      <section className="card">
        <h2 className="text-base font-semibold text-gray-900">Como posso ajudar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
          {AJUDAS.map(({ icon: Icon, titulo }) => (
            <div key={titulo} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-blue-600" />
              </span>
              <span className="text-sm text-gray-800 min-w-0">{titulo}</span>
            </div>
          ))}
        </div>

        {/* ── 5. CTA → scroll suave até a solicitação ── */}
        <button
          onClick={irParaConsultoria}
          className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
        >
          Quero saber mais sobre a consultoria <ArrowDown size={16} />
        </button>
      </section>

      {/* ── 6. Consultoria existente (lógica preservada) ── */}
      <div ref={formRef} className="scroll-mt-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <MessageCircle size={22} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">Consultoria financeira com Matheus Almeida</h2>
            <p className="text-sm text-gray-500 mt-1">
              Planejamento personalizado para organizar sua vida financeira.
            </p>
          </div>
        </div>

        {jaRegistrou ? (
          // Estado: interesse registrado
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-green-900">Interesse registrado!</h3>
                <p className="text-sm text-green-800 mt-1">
                  Você será avisado pelo WhatsApp sobre a disponibilidade da consultoria.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Card em destaque */}
            <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <UserCheck size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-blue-900">Atendimento personalizado</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Quer receber informações sobre disponibilidade e agendamento? Deixe seu WhatsApp e
                    entraremos em contato por lá.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="card space-y-4">
              <div>
                <label className="label">Nome</label>
                <input
                  className="input" value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="label">WhatsApp</label>
                <input
                  className="input" inputMode="numeric"
                  value={mascararTelefone(whatsapp)}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

              <button type="submit" disabled={salvando}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                {salvando
                  ? <><Loader2 size={15} className="animate-spin" /> Registrando...</>
                  : <><MessageCircle size={16} /> Quero ser avisado pelo WhatsApp</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
