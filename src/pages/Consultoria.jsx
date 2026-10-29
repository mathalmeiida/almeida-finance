import React, { useState, useRef } from 'react'

import {

  MessageCircle, CheckCircle2, Loader2, Award, GraduationCap,

  BadgeCheck, Wallet, PiggyBank, Target, LineChart, ListChecks,

  TrendingDown, ChevronDown, ChevronUp, ArrowRight, Sparkles,

  BriefcaseBusiness,

} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

import { useConsultoriaInteresses } from '../hooks/useConsultoria'

import { mascararTelefone, somenteDigitosTelefone, telefoneValido } from '../lib/utils'



// Foto ORIGINAL do aplicativo. Não substituir nem editar este arquivo de imagem.*

const fotoMatheus = '/images/foto%20perfil.png'



const AJUDAS = [

  { icon: Wallet, titulo: 'Organização das finanças pessoais', descricao: 'Organize receitas, despesas e cartões.' },

  { icon: TrendingDown, titulo: 'Controle de gastos', descricao: 'Identifique oportunidades de economia.' },

  { icon: LineChart, titulo: 'Planejamento financeiro', descricao: 'Planeje metas e decisões financeiras.' },

  { icon: PiggyBank, titulo: 'Construção de reserva de emergência', descricao: 'Prepare-se melhor para imprevistos.' },

  { icon: Target, titulo: 'Organização para grandes objetivos', descricao: 'Imóvel, viagem, carro, estudos e mais.' },

  { icon: ListChecks, titulo: 'Análise do orçamento', descricao: 'Tenha uma visão mais clara das suas finanças.' },

]



const painel = 'rounded-2xl border border-white/10 bg-[#1f2735] shadow-sm'

const bloco = 'rounded-xl bg-[#293345] p-4'



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

    <div className="w-full max-w-none min-w-0 space-y-5 pb-mobilenav md:pb-4 text-slate-100">

      {/* Apresentação principal — foto original preservada. */}

      <section className={`${painel} overflow-hidden`}>

        <div className="grid grid-cols-1 items-start gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.85fr)] lg:gap-9 lg:p-9">

          <div className="min-w-0 order-2 lg:order-1">

            <span className="inline-flex items-center gap-2 rounded-full bg-marca-100 px-3 py-1.5 text-sm font-semibold text-marca">

              <Sparkles size={15} /> Sobre mim

            </span>

            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">

              Conheça Matheus Almeida

            </h1>

            <p className="mt-2 text-base text-slate-300">

              Experiência, planejamento e soluções para sua vida financeira.

            </p>

            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-200 sm:text-base">

              <p>

                Sou Engenheiro de Produção e atuo há mais de 7 anos no mercado financeiro,

                com experiência no relacionamento com clientes e na identificação de soluções

                para diferentes momentos da vida.

              </p>

              <p>

                Possuo certificações profissionais da ANBIMA, incluindo CPA e C-Pro R.

                Criei o Almeida Finance para ajudar você a organizar seu dinheiro, controlar

                os gastos e planejar seus objetivos de forma mais clara e acessível.

              </p>

            </div>

            <button

              type="button"

              onClick={() => setMostrarTrajetoria(v => !v)}

              aria-expanded={mostrarTrajetoria}

              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-marca-100 px-4 py-2.5 text-sm font-semibold text-marca transition-opacity hover:opacity-85"

            >

              Conheça minha trajetória

              {mostrarTrajetoria ? <ChevronUp size={17} /> : <ChevronDown size={17} />}

            </button>

            {mostrarTrajetoria && (

              <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm leading-7 text-slate-200">

                <p>Minha trajetória profissional foi construída ao longo de mais de 7 anos no mercado financeiro, trabalhando diretamente com clientes, planejamento financeiro e identificação de soluções para diferentes momentos da vida.</p>

                <p>Sou Engenheiro de Produção e possuo certificações profissionais da ANBIMA, incluindo CPA e C-Pro R, voltadas à qualificação de profissionais que atuam no mercado financeiro e no relacionamento com clientes.</p>

                <p>Ao longo dessa experiência, percebi que muitas pessoas têm uma boa renda, mas ainda encontram dificuldades para organizar o dinheiro, controlar os gastos e transformar seus objetivos em um planejamento financeiro claro.</p>

                <p>Foi a partir dessa necessidade que nasceu o Almeida Finance: uma ferramenta criada para tornar o controle financeiro mais simples, visual e acessível.</p>

                <p>Além do aplicativo, quero ajudar de forma mais próxima quem busca organizar melhor sua vida financeira e tomar decisões mais conscientes com o próprio dinheiro.</p>

              </div>

            )}

          </div>



          <div className="order-1 flex min-w-0 flex-col items-center gap-3 lg:order-2">

            <div className="w-full max-w-[270px] sm:max-w-[310px] lg:max-w-[340px] mx-auto overflow-hidden rounded-2xl">

              <img

                src={fotoMatheus}

                alt="Foto profissional original de Matheus Almeida"

                className="block w-full h-auto object-contain"

              />

            </div>

            <div className="flex w-full max-w-[270px] sm:max-w-[310px] lg:max-w-[340px] mx-auto items-center gap-3 rounded-xl bg-[#293c60] px-4 py-3">

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca text-white"><BriefcaseBusiness size={22} /></span>

              <div>

                <p className="font-bold text-white">Mais de 7 anos</p>

                <p className="text-sm text-slate-300">de experiência no mercado financeiro</p>

              </div>

            </div>

          </div>

        </div>



        <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-3 sm:px-7 sm:pb-7 lg:px-9 lg:pb-9">

          {[

            { icon: Award, titulo: '7+ anos', subtitulo: 'Experiência no mercado financeiro' },

            { icon: GraduationCap, titulo: 'Engenharia de Produção', subtitulo: 'Formação acadêmica' },

            { icon: BadgeCheck, titulo: 'ANBIMA', subtitulo: 'Certificações CPA e C-Pro R' },

          ].map(({ icon: Icon, titulo, subtitulo }) => (

            <div key={titulo} className={`${bloco} flex min-w-0 items-center gap-3`}>

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><Icon size={22} /></span>

              <div className="min-w-0">

                <p className="font-semibold text-white">{titulo}</p>

                <p className="mt-0.5 text-sm leading-5 text-slate-300">{subtitulo}</p>

              </div>

            </div>

          ))}

        </div>

      </section>



      <section className={`${painel} p-5 sm:p-7`}>

        <div className="flex items-start gap-3">

          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><ListChecks size={22} /></span>

          <div>

            <h2 className="text-xl font-bold text-white sm:text-2xl">Como posso ajudar</h2>

            <p className="mt-1 text-sm text-slate-300 sm:text-base">Soluções para diferentes momentos da sua vida financeira.</p>

          </div>

        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

          {AJUDAS.map(({ icon: Icon, titulo, descricao }) => (

            <div key={titulo} className="flex min-w-0 items-center gap-3 rounded-xl bg-[#293345] p-4">

              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><Icon size={23} /></span>

              <div className="min-w-0">

                <p className="text-sm font-semibold text-white sm:text-base">{titulo}</p>

                <p className="mt-1 text-sm leading-5 text-slate-300">{descricao}</p>

              </div>

            </div>

          ))}

        </div>

      </section>



      <section ref={formRef} className={`${painel} scroll-mt-20 p-5 sm:p-7`}>

        <div className="flex items-start gap-3">

          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca"><MessageCircle size={24} /></span>

          <div className="min-w-0">

            <h2 className="text-xl font-bold text-white sm:text-2xl">Consultoria financeira com Matheus Almeida</h2>

            <p className="mt-1 text-sm text-slate-300 sm:text-base">Atendimento voltado à organização e ao planejamento das finanças pessoais.</p>

          </div>

        </div>



        <div className="mt-5 grid gap-2 text-sm text-slate-200 sm:grid-cols-3">

          {['Atendimento individual', 'Orientação prática', 'Foco nos seus objetivos'].map(item => (

            <div className="flex items-center gap-2" key={item}><CheckCircle2 size={17} className="shrink-0 text-marca" />{item}</div>

          ))}

        </div>



        {jaRegistrou ? (

          <div className="mt-5 space-y-3">

            <button type="button" onClick={irParaConsultoria} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold">

              Ver meu interesse <ArrowRight size={17} />

            </button>

            <div className="flex items-start gap-3 rounded-xl border border-emerald-600/40 bg-emerald-950/30 p-4">

              <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-400" />

              <p className="text-sm text-slate-200"><strong className="text-white">Interesse registrado.</strong> Você será avisado pelo WhatsApp quando houver disponibilidade.</p>

            </div>

          </div>

        ) : (

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-white/10 pt-5">

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-200">Nome</label>

                <input className="input w-full" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required />

              </div>

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-200">WhatsApp</label>

                <input className="input w-full" inputMode="numeric" value={mascararTelefone(whatsapp)} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" required />

              </div>

            </div>

            {erro && <p role="alert" className="rounded-xl bg-red-950/30 p-3 text-sm text-red-300">{erro}</p>}

            <button type="submit" disabled={salvando} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-60">

              {salvando ? <><Loader2 size={17} className="animate-spin" /> Registrando...</> : <>Quero saber mais sobre a consultoria <ArrowRight size={17} /></>}

            </button>

          </form>

        )}

      </section>

    </div>

  )

}