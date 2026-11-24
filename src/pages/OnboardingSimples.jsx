import React, { useState, useEffect } from 'react'

import { useSearchParams } from 'react-router-dom'

import { FileText, Wallet, ArrowRight, CheckCircle2, Upload, Loader2, X, TrendingUp, TrendingDown, CreditCard, UtensilsCrossed } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

import { useCategorias } from '../hooks/useCategorias'

import { useCartoes } from '../hooks/useCartoes'

import { useBeneficios } from '../hooks/useBeneficios'

import { useInvestimentos } from '../hooks/useInvestimentos'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'

import InputMoeda from '../components/InputMoeda'

import ImportacaoInteligente from './ImportacaoInteligente'

import { hojeISO as hojeISOBrasil, formatCurrency } from '../lib/utils'

import { supabase } from '../lib/supabase'

const CHAVE_CONFIGURANDO = 'almeida_configurando_onboarding'

const ETAPA_BOAS_VINDAS = 'boas-vindas'

const ETAPA_CENTRAL = 'central'

const ETAPA_SALDO = 'saldo'

const ETAPA_RECEITAS = 'receitas'

const ETAPA_DESPESAS = 'despesas'

const ETAPA_CARTOES = 'cartoes'

const ETAPA_BENEFICIOS = 'beneficios'

const ETAPA_INVESTIMENTOS = 'investimentos'

const ETAPA_IMPORTACAO = 'importacao'

const ETAPA_CONCLUSAO = 'conclusao'

export default function OnboardingSimples({ aoConcluir, etapaInicial: etapaInicialProp }) {

  const { usuario, perfil, atualizarPreferenciasLimite } = useAuth()

  const { categorias: categoriasReceita } = useCategorias('receita')

  const { categorias: categoriasDespesa } = useCategorias('despesa')

  const { cartoes } = useCartoes()

  const { beneficios } = useBeneficios()

  const { investimentos } = useInvestimentos()
  const { receitas } = useReceitas()
  const { despesas } = useDespesas()

  const [searchParams] = useSearchParams()

  // Flag para prevenir navegação automática durante digitação
  const [processandoOnboarding, setProcessandoOnboarding] = useState(true)

  // Estados para contadores de resumo

  const [contadores, setContadores] = useState({

    receitas: 0,

    despesas: 0,

  })

  const [etapa, setEtapa] = useState(() => {
    // Prioridade: prop do App.jsx > searchParams > boas-vindas
    if (etapaInicialProp === 'central') return ETAPA_CENTRAL
    if (searchParams.get('etapa') === 'central') return ETAPA_CENTRAL
    return ETAPA_BOAS_VINDAS
  }
  )

  const [modo, setModo] = useState(() =>
    (etapaInicialProp === 'central' || searchParams.get('etapa') === 'central') ? 'manual' : null
  )

  const [salvando, setSalvando] = useState(false)

  // Estados de configuração manual

  const [saldo, setSaldo] = useState(0)

  // 'Não utilizo': conjunto de módulos que o usuário declarou não utilizar.
  // Persiste em localStorage para sobreviver ao reload. Chave por userId.
  const CHAVE_NAO_UTILIZO = (id) => 'almeida_onboarding_nao_utilizo_' + id

  const [modulosNaoUtilizo, setModulosNaoUtilizo] = useState(() => {
    try {
      const id = usuario?.id
      if (!id) return []
      return JSON.parse(localStorage.getItem('almeida_onboarding_nao_utilizo_' + id) || '[]')
    } catch { return [] }
  })

  // Re-carrega quando o userId chega (caso carregue depois do mount)
  useEffect(() => {
    if (!usuario?.id) return
    try {
      const saved = JSON.parse(localStorage.getItem('almeida_onboarding_nao_utilizo_' + usuario.id) || '[]')
      setModulosNaoUtilizo(saved)
    } catch {}
  }, [usuario?.id])

  function toggleNaoUtilizo(modulo) {
    const nova = modulosNaoUtilizo.includes(modulo)
      ? modulosNaoUtilizo.filter(m => m !== modulo)
      : [...modulosNaoUtilizo, modulo]
    setModulosNaoUtilizo(nova)
    if (usuario?.id) {
      try { localStorage.setItem('almeida_onboarding_nao_utilizo_' + usuario.id, JSON.stringify(nova)) } catch {}
    }
  }

  // Status de cada módulo
  function statusModulo(modulo) {
    const naoUsa = modulosNaoUtilizo.includes(modulo)
    if (naoUsa) return 'nao_utilizo'
    switch (modulo) {
      case 'saldo':         return perfil?.saldo_base != null ? 'configurado' : 'nao_configurado'
      case 'receitas':      return receitas.length > 0 ? 'configurado' : 'nao_configurado'
      case 'despesas':      return despesas.length > 0 ? 'configurado' : 'nao_configurado'
      case 'cartoes':       return cartoes.length > 0 ? 'configurado' : 'nao_configurado'
      case 'vrva':          return beneficios.length > 0 ? 'configurado' : 'nao_configurado'
      case 'investimentos': return investimentos.length > 0 ? 'configurado' : 'nao_configurado'
      default:              return 'nao_configurado'
    }
  }

  // O retorno é explícito: prop etapaInicial='central' (via App.jsx/CHAVE_ETAPA_ONBOARDING)
  // ou searchParams ?etapa=central como fallback.
  // Não usamos document.referrer (não funciona de forma confiável em SPA/PWA).
  useEffect(() => {
    if (etapaInicialProp === 'central' || searchParams.get('etapa') === 'central') {
      setModo('manual')
      setEtapa(ETAPA_CENTRAL)
    }
  }, [etapaInicialProp, searchParams])

  // Ativa modo configuração quando entra na ETAPA_CENTRAL

  useEffect(() => {

    if (etapa === ETAPA_CENTRAL) {

      localStorage.setItem(CHAVE_CONFIGURANDO, '1')
      
      // Salva etapa para preservar após reload
      try {
        localStorage.setItem('almeida_onboarding_etapa', 'central')
      } catch { /* ignore */ }

    }

  }, [etapa])

  // Carrega dados existentes APENAS UMA VEZ no mount
  const [saldoCarregado, setSaldoCarregado] = useState(false)
  useEffect(() => {
    if (perfil?.saldo_base && !saldoCarregado) {
      setSaldo(Number(perfil.saldo_base))
      setSaldoCarregado(true)
    }
  }, [perfil, saldoCarregado])

  async function handleEscolha(escolha) {

    setModo(escolha)

    if (escolha === 'importar') {

      setEtapa(ETAPA_IMPORTACAO)

    } else {

      setEtapa(ETAPA_CENTRAL)
      
      // Seta flag de configuração ao entrar na central
      try {
        localStorage.setItem(CHAVE_CONFIGURANDO, '1')
      } catch { /* ignore */ }

    }

  }

  async function handlePular() {
    // Apenas avança para a central, NÃO conclui o onboarding
    setModo('manual')
    setEtapa(ETAPA_CENTRAL)
  }

  function handleImportacaoConcluida() {

    setEtapa(ETAPA_CONCLUSAO)

  }

  async function handleConcluir() {
    // Marca que está processando para prevenir navegação indevida
    setProcessandoOnboarding(true)
    
    // Limpa a flag de configuração ANTES de marcar como concluído
    try {
      localStorage.removeItem(CHAVE_CONFIGURANDO)
    } catch {}
    
    // Conclui o onboarding
    if (aoConcluir) await aoConcluir()
    
    // Mantém o flag ativo até a navegação ser completada
    setProcessandoOnboarding(false)
  }

  // Carrega resumo real do banco

  const [resumo, setResumo] = useState({

    saldo: 0,

    receitas: 0,

    despesas: 0,

    cartoes: 0,

    investimentos: 0,

  })

  useEffect(() => {

    if (etapa === ETAPA_CONCLUSAO && usuario?.id) {

      async function carregarResumo() {

        try {

          const [receitasRes, despesasRes] = await Promise.all([

            supabase.from('receitas').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.id),

            supabase.from('despesas').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.id),

          ])

          setResumo({

            saldo: perfil?.saldo_base || 0,

            receitas: receitasRes.count || 0,

            despesas: despesasRes.count || 0,

            cartoes: cartoes.length,

            investimentos: investimentos.length,

          })

        } catch (err) {

          console.error('Erro ao carregar resumo:', err)

        }

      }

      carregarResumo()

    }

  }, [etapa, usuario, perfil, cartoes, investimentos])

  if (etapa === ETAPA_BOAS_VINDAS) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">

        <div className="w-full max-w-lg">

          <div className="text-center mb-8">

            <div className="w-16 h-16 bg-marca rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background: '#801D39'}}>

              <Wallet size={32} className="text-white" />

            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">

              Vamos organizar suas finanças

            </h1>

            <p className="text-gray-600">

              Escolha como deseja começar. Você pode configurar tudo depois.

            </p>

          </div>

          <div className="space-y-3">

            <button

              onClick={() => handleEscolha('importar')}

              className="w-full bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group"

            >

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-marca/10 transition-colors" style={{background: '#FFF5F7'}}>

                  <FileText size={24} style={{color: '#801D39'}} />

                </div>

                <div className="flex-1">

                  <h3 className="font-bold text-gray-900 mb-1">Importar meus dados</h3>

                  <p className="text-sm text-gray-600">

                    Anexe extratos bancários, faturas e investimentos

                  </p>

                </div>

                <ArrowRight size={20} className="text-gray-400 group-hover:text-marca transition-colors" />

              </div>

            </button>

            <button

              onClick={() => handleEscolha('manual')}

              className="w-full bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group"

            >

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-marca/10 transition-colors" style={{background: '#FFF5F7'}}>

                  <Wallet size={24} style={{color: '#801D39'}} />

                </div>

                <div className="flex-1">

                  <h3 className="font-bold text-gray-900 mb-1">Configurar manualmente</h3>

                  <p className="text-sm text-gray-600">

                    Informe seu saldo, renda e despesas

                  </p>

                </div>

                <ArrowRight size={20} className="text-gray-400 group-hover:text-marca transition-colors" />

              </div>

            </button>

          </div>

          <button

            onClick={handlePular}

            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 py-3"

          >

            Pular por enquanto

          </button>

        </div>

      </div>

    )

  }

  if (etapa === ETAPA_CENTRAL) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">

        <div className="w-full max-w-2xl">

          <div className="text-center mb-6">

            <button

              onClick={() => {
                // Se veio de um refazer (retorno da configuração), volta para a Home
                // Se veio do fluxo normal (escolha inicial), volta para boas-vindas
                if (etapaInicialProp === 'central') {
                  try {
                    localStorage.removeItem('almeida_refazer_onboarding')
                    localStorage.removeItem('almeida_onboarding_etapa')
                    localStorage.removeItem('almeida_configurando_onboarding')
                  } catch { /* ignore */ }
                  window.location.assign('/')
                } else {
                  setEtapa(ETAPA_BOAS_VINDAS)
                }
              }}

              className="text-sm text-gray-600 hover:text-gray-900 mb-4"

            >

              ← Voltar

            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">

              Configure suas finanças

            </h2>

            <p className="text-gray-600 text-sm">

              Escolha os módulos que deseja configurar agora

            </p>

          </div>

          <div className="space-y-3">

            {/* ─── Módulos de configuração ─── */}
            {/* Componente de badge de status */}
            {[
              {
                id: 'saldo', label: 'Saldo e Contas',
                desc: 'Saldo bancário disponível hoje',
                icone: <Wallet size={22} style={{color:'#801D39'}} />,
                bg: 'bg-surface-2',
                onClick: () => setEtapa(ETAPA_SALDO),
              },
              {
                id: 'receitas', label: 'Receitas',
                desc: 'Salários, rendas e entradas',
                icone: <TrendingUp size={22} className="text-green-600" />,
                bg: 'bg-green-50',
                onClick: () => { localStorage.setItem(CHAVE_CONFIGURANDO, '1'); window.location.href = '/receitas?origem=onboarding' },
              },
              {
                id: 'despesas', label: 'Despesas',
                desc: 'Gastos fixos e variáveis',
                icone: <TrendingDown size={22} className="text-red-600" />,
                bg: 'bg-red-50',
                onClick: () => { localStorage.setItem(CHAVE_CONFIGURANDO, '1'); window.location.href = '/despesas?origem=onboarding' },
              },
              {
                id: 'cartoes', label: 'Cartões de crédito',
                desc: 'Acompanhe faturas e limites',
                icone: <CreditCard size={22} className="text-marca" />,
                bg: 'bg-surface-2',
                onClick: () => { localStorage.setItem(CHAVE_CONFIGURANDO, '1'); window.location.href = '/cartoes?origem=onboarding' },
              },
              {
                id: 'vrva', label: 'VR / VA',
                desc: 'Vale-refeição e vale-alimentação',
                icone: <UtensilsCrossed size={22} className="text-amber-600" />,
                bg: 'bg-amber-50',
                onClick: () => { localStorage.setItem(CHAVE_CONFIGURANDO, '1'); window.location.href = '/beneficios?origem=onboarding' },
              },
              {
                id: 'investimentos', label: 'Investimentos',
                desc: 'Patrimônio investido',
                icone: <TrendingUp size={22} className="text-blue-600" />,
                bg: 'bg-blue-50',
                onClick: () => { localStorage.setItem(CHAVE_CONFIGURANDO, '1'); window.location.href = '/investimentos?origem=onboarding' },
              },
            ].map(mod => {
              const st = statusModulo(mod.id)
              const ehConfigurado = st === 'configurado'
              const ehNaoUtilizo = st === 'nao_utilizo'
              return (
                <div key={mod.id} className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                  {/* Linha principal: ícone + título + status + seta */}
                  <button
                    onClick={mod.onClick}
                    disabled={ehNaoUtilizo}
                    className={`w-full p-4 transition-all flex items-center gap-3 text-left ${ehNaoUtilizo ? 'opacity-50 cursor-not-allowed' : 'hover:border-marca hover:shadow-sm group'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center flex-shrink-0`}>
                      {mod.icone}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{mod.label}</span>
                        {ehConfigurado && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Configurado</span>
                        )}
                        {ehNaoUtilizo && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Não utilizo</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{mod.desc}</p>
                    </div>
                    {!ehNaoUtilizo && <ArrowRight size={16} className="text-gray-400 group-hover:text-marca flex-shrink-0" />}
                  </button>
                  {/* Linha secundária: Não utilizo / Desfazer */}
                  <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {ehNaoUtilizo
                        ? 'Declarado como não utilizado'
                        : ehConfigurado
                          ? 'Módulo configurado — clique para editar'
                          : 'Opcional — configure quando quiser'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleNaoUtilizo(mod.id)}
                      className={`text-xs font-medium underline underline-offset-2 ml-3 whitespace-nowrap ${ehNaoUtilizo ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {ehNaoUtilizo ? 'Desfazer' : 'Não utilizo'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-6">

            <button

              onClick={() => setEtapa(ETAPA_CONCLUSAO)}

              className="btn-primary w-full flex items-center justify-center gap-2"

            >

              Concluir configuração

              <ArrowRight size={16} />

            </button>

          </div>

        </div>

      </div>

    )

  }

  if (etapa === ETAPA_SALDO) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">

        <div className="w-full max-w-lg">

          <div className="bg-white rounded-2xl shadow-lg p-8">

            <button

              onClick={() => setEtapa(ETAPA_CENTRAL)}

              className="text-sm text-gray-600 hover:text-gray-900 mb-4"

            >

              ← Voltar para central

            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6">Saldo e Contas</h2>

            <div className="space-y-6">

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-2">

                  Saldo inicial em conta

                </label>

                <InputMoeda

                  valor={saldo}

                  onChangeValor={setSaldo}

                  className="input text-xl font-bold text-center py-3"

                />

                <p className="text-xs text-gray-500 mt-1">

                  Quanto você tem disponível hoje

                </p>

              </div>

            </div>

            <div className="flex gap-3 mt-8">

              <button

                onClick={() => setEtapa(ETAPA_CENTRAL)}

                className="btn-secondary flex-1"

              >

                Voltar

              </button>

              <button

                onClick={async () => {

                  setSalvando(true)

                  try {

                    if (saldo > 0) {

                      await atualizarPreferenciasLimite({

                        saldo_base: saldo,

                        saldo_base_data: hojeISOBrasil(),

                      })

                    }

                    setEtapa(ETAPA_CENTRAL)

                  } catch (err) {

                    alert('Erro ao salvar: ' + (err?.message || String(err)))

                  } finally {

                    setSalvando(false)

                  }

                }}

                disabled={salvando}

                className="btn-primary flex-1 flex items-center justify-center gap-2"

              >

                {salvando ? (

                  <>

                    <Loader2 size={16} className="animate-spin" />

                    Salvando...

                  </>

                ) : (

                  <>

                    Salvar

                    <CheckCircle2 size={16} />

                  </>

                )}

              </button>

            </div>

          </div>

        </div>

      </div>

    )

  }

  if (etapa === ETAPA_IMPORTACAO) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">

        <div className="max-w-4xl mx-auto p-4">

          <div className="mb-4">

            <button

              onClick={() => setEtapa(ETAPA_BOAS_VINDAS)}

              className="text-sm text-gray-600 hover:text-gray-900"

            >

              ← Voltar

            </button>

          </div>

          <ImportacaoInteligente

            embutido

            onConcluir={handleImportacaoConcluida}

            onCancelar={() => setEtapa(ETAPA_BOAS_VINDAS)}

          />

        </div>

      </div>

    )

  }

  if (etapa === ETAPA_CONCLUSAO) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">

        <div className="w-full max-w-lg">

          <div className="text-center mb-8">

            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">

              <CheckCircle2 size={32} className="text-green-600" />

            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">

              Tudo pronto!

            </h1>

            <p className="text-gray-600">

              Suas finanças estão organizadas

            </p>

          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">

            <h3 className="font-bold text-gray-900 mb-4">Resumo</h3>

            <div className="space-y-3">

              <div className="flex justify-between items-center">

                <span className="text-gray-600">Saldo disponível</span>

                <span className="font-bold text-gray-900">

                  {formatCurrency(resumo.saldo)}

                </span>

              </div>

              {resumo.receitas > 0 && (

                <div className="flex justify-between items-center">

                  <span className="text-gray-600">Receitas cadastradas</span>

                  <span className="font-semibold text-green-600">{resumo.receitas}</span>

                </div>

              )}

              {resumo.despesas > 0 && (

                <div className="flex justify-between items-center">

                  <span className="text-gray-600">Despesas cadastradas</span>

                  <span className="font-semibold text-red-600">{resumo.despesas}</span>

                </div>

              )}

              {resumo.cartoes > 0 && (

                <div className="flex justify-between items-center">

                  <span className="text-gray-600">Cartões cadastrados</span>

                  <span className="font-semibold text-marca">{resumo.cartoes}</span>

                </div>

              )}

              {resumo.investimentos > 0 && (

                <div className="flex justify-between items-center">

                  <span className="text-gray-600">Investimentos</span>

                  <span className="font-semibold text-marca">{resumo.investimentos}</span>

                </div>

              )}

            </div>

          </div>

          <button

            onClick={handleConcluir}

            className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"

          >

            Ir para minha Home

            <ArrowRight size={20} />

          </button>

        </div>

      </div>

    )

  }

  return null

}
