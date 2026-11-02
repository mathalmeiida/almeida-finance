import React, { useState, useRef } from 'react'

import {

  MessageCircle, CheckCircle2, Loader2, GraduationCap,

  BadgeCheck, Wallet, PiggyBank, LineChart, ListChecks,

  ChevronDown, ChevronUp, ArrowRight, Sparkles,

  BriefcaseBusiness,

} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

import { useConsultoriaInteresses } from '../hooks/useConsultoria'

import { mascararTelefone, somenteDigitosTelefone, telefoneValido } from '../lib/utils'
// Foto ORIGINAL do aplicativo. Não substituir nem editar este arquivo de imagem.
const fotoMatheus = '/images/foto%20perfil.png'

const AJUDAS = [

  { icon: Wallet,       titulo: 'Organização financeira',         descricao: 'Receitas, despesas, cartões e saldo no mesmo lugar.' },
  { icon: LineChart,    titulo: 'Planejamento e metas',           descricao: 'Estratégias para objetivos de curto, médio e longo prazo.' },
  { icon: PiggyBank,    titulo: 'Simulação de decisões',          descricao: 'Simule cenários antes de tomar decisões financeiras.' },
  { icon: ListChecks,   titulo: 'Acompanhamento personalizado',   descricao: 'Orientações práticas para a sua realidade financeira.' },
]

const painel = 'rounded-2xl border border-marca/15 bg-white shadow-sm'

const bloco = 'rounded-xl bg-marca-100/50 border border-marca/10 p-4'

export default function Consultoria() {

  const { usuario, perfil } = useAuth()

  const { interesses, criarInteresse } = useConsultoriaInteresses()

  const nomePadrao = perfil?.nome || usuario?.email?.split('@')[0] || ''

  const [nome, setNome] = useState(nomePadrao)

  const [whatsapp, setWhatsapp] = useState('')

  const [salvando, setSalvando] = useState(false)

  const [erro, setErro] = useState('')

  const [registrado, setRegistrado] = useState(false)

  const [mostrarTrajetoria, setMostrarTrajetoria] = useState(false)

  const formRef = useRef(null)

  const jaRegistrou = registrado || (interesses?.length || 0) > 0

  function irParaConsultoria() {

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  }

  async function handleSubmit(e) {

    e.preventDefault()

    if (salvando || jaRegistrou) return

    setErro('')

    if (!nome.trim()) { setErro('Informe seu nome.'); return }

    if (!telefoneValido(whatsapp)) { setErro('Informe um WhatsApp válido com DDD.'); return }

    setSalvando(true)

    try {

      await criarInteresse({ nome: nome.trim(), whatsapp: somenteDigitosTelefone(whatsapp) })

      setRegistrado(true)

    } catch {

      setErro('Não foi possível registrar seu interesse agora. Tente novamente.')

    } finally {

      setSalvando(false)

    }

  }

  return (

    <div className="w-full max-w-none min-w-0 space-y-5 pb-mobilenav md:pb-4 text-gray-900">

      {/* Apresentação principal — foto original preservada. */}

      <section className={`${painel} overflow-hidden`}>

        <div className="grid grid-cols-1 items-start gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)] lg:gap-8 lg:p-8">

          {/* Coluna de texto — esquerda no desktop, baixo no mobile */}
          <div className="min-w-0 order-2 lg:order-1">

            <span className="inline-flex items-center gap-2 rounded-full bg-marca-100 px-3 py-1.5 text-sm font-semibold text-marca">

              <Sparkles size={15} /> Sobre mim

            </span>

            <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">

              Matheus Almeida

            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">

              Engenheiro de Produção com certificações ANBIMA (CPA e C-Pro R) e mais de 7 anos
              de experiência no mercado financeiro. Criador do Almeida Finance para tornar o
              controle financeiro mais simples e acessível.

            </p>

            <button

              type="button"

              onClick={() => setMostrarTrajetoria(v => !v)}

              aria-expanded={mostrarTrajetoria}

              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-marca-100 px-4 py-2 text-sm font-semibold text-marca transition-opacity hover:opacity-85"

            >

              Conheça minha trajetória

              {mostrarTrajetoria ? <ChevronUp size={16} /> : <ChevronDown size={16} />}

            </button>

            {mostrarTrajetoria && (

              <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 text-sm leading-6 text-gray-700">

                <p>Ao longo de mais de 7 anos no mercado financeiro trabalhei diretamente com clientes, planejamento financeiro e identificação de soluções para diferentes momentos da vida.</p>

                <p>Percebi que muitas pessoas têm boa renda, mas encontram dificuldades para organizar o dinheiro e transformar objetivos em um plano claro. Foi a partir dessa necessidade que nasceu o Almeida Finance.</p>

                <p>Além do aplicativo, ofereço consultoria pessoal para quem busca organizar melhor as finanças e tomar decisões mais conscientes.</p>

              </div>

            )}

          </div>

          {/* Foto — direita no desktop, topo no mobile */}
          <div className="order-1 flex min-w-0 flex-col items-center lg:order-2">

            <div className="w-full max-w-[260px] sm:max-w-[300px] lg:max-w-[320px] mx-auto overflow-hidden rounded-2xl">

              <img

                src={fotoMatheus}

                alt="Foto profissional de Matheus Almeida"

                className="block w-full h-auto object-contain"

              />

            </div>

          </div>

        </div>

        {/* Três cards compactos: Experiência, Formação, Certificações */}
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-3 sm:px-7 sm:pb-7 lg:px-8 lg:pb-8">

          {[

            { icon: BriefcaseBusiness, titulo: 'Experiência',     subtitulo: '+7 anos no mercado financeiro' },

            { icon: GraduationCap,    titulo: 'Formação',         subtitulo: 'Engenharia de Produção' },

            { icon: BadgeCheck,       titulo: 'Certificações',    subtitulo: 'ANBIMA — CPA e C-Pro R' },

          ].map(({ icon: Icon, titulo, subtitulo }) => (

            <div key={titulo} className={`${bloco} flex min-w-0 items-center gap-3`}>

              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><Icon size={20} /></span>

              <div className="min-w-0">

                <p className="text-sm font-semibold text-gray-900">{titulo}</p>

                <p className="mt-0.5 text-xs leading-5 text-gray-600">{subtitulo}</p>

              </div>

            </div>

          ))}

        </div>

      </section>

      <section className={`${painel} p-5 sm:p-7`}>

        <div className="flex items-start gap-3">

          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><ListChecks size={22} /></span>

          <div>

            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Como posso ajudar</h2>

            <p className="mt-1 text-sm text-gray-600 sm:text-base">Soluções para diferentes momentos da sua vida financeira.</p>

          </div>

        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

          {AJUDAS.map(({ icon: Icon, titulo, descricao }) => (

            <div key={titulo} className="flex min-w-0 items-center gap-3 rounded-xl bg-marca-100/50 p-4">

              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><Icon size={23} /></span>

              <div className="min-w-0">

                <p className="text-sm font-semibold text-gray-900 sm:text-base">{titulo}</p>

                <p className="mt-1 text-sm leading-5 text-gray-600">{descricao}</p>

              </div>

            </div>

          ))}

        </div>

      </section>

      <section ref={formRef} className={`${painel} scroll-mt-20 p-5 sm:p-7`}>

        <div className="flex items-start gap-3">

          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><MessageCircle size={24} /></span>

          <div className="min-w-0">

            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Consultoria financeira com Matheus Almeida</h2>

            <p className="mt-1 text-sm text-gray-600 sm:text-base">Atendimento voltado à organização e ao planejamento das finanças pessoais.</p>

          </div>

        </div>

        <div className="mt-5 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">

          {['Atendimento individual', 'Orientação prática', 'Foco nos seus objetivos'].map(item => (

            <div className="flex items-center gap-2" key={item}><CheckCircle2 size={17} className="shrink-0 text-marca" />{item}</div>

          ))}

        </div>

        {jaRegistrou ? (

          <div className="mt-5 space-y-3">

            <button type="button" onClick={irParaConsultoria} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold">

              Ver meu interesse <ArrowRight size={17} />

            </button>

            <div className="flex items-start gap-3 rounded-xl border border-emerald-600/40 bg-emerald-50 p-4">

              <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-700" />

              <p className="text-sm text-gray-700"><strong className="text-gray-900">Interesse registrado.</strong> Você será avisado pelo WhatsApp quando houver disponibilidade.</p>

            </div>

          </div>

        ) : (

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-gray-200 pt-5">

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">Nome</label>

                <input className="input w-full" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required />

              </div>

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">WhatsApp</label>

                <input className="input w-full" inputMode="numeric" value={mascararTelefone(whatsapp)} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" required />

              </div>

            </div>

            {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

            <button type="submit" disabled={salvando} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-60">

              {salvando ? <><Loader2 size={17} className="animate-spin" /> Registrando...</> : <>Quero saber mais sobre a consultoria <ArrowRight size={17} /></>}

            </button>

          </form>

        )}

      </section>

    </div>

  )

}