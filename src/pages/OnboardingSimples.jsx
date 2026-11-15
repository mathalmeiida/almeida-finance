import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Wallet, ArrowRight, CheckCircle2, Upload, Loader2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useBeneficios } from '../hooks/useBeneficios'
import { useInvestimentos } from '../hooks/useInvestimentos'
import InputMoeda from '../components/InputMoeda'
import ImportacaoInteligente from './ImportacaoInteligente'
import { hojeISO as hojeISOBrasil, formatCurrency } from '../lib/utils'
import { supabase } from '../lib/supabase'

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

export default function OnboardingSimples({ aoConcluir }) {
  const { usuario, perfil, atualizarPreferenciasLimite } = useAuth()
  const { categorias: categoriasReceita } = useCategorias('receita')
  const { categorias: categoriasDespesa } = useCategorias('despesa')
  const { cartoes } = useCartoes()
  const { beneficios } = useBeneficios()
  const { investimentos } = useInvestimentos()
  
  const [searchParams] = useSearchParams()
  
  // Estados para contadores de resumo
  const [contadores, setContadores] = useState({
    receitas: 0,
    despesas: 0,
  })

  const [etapa, setEtapa] = useState(ETAPA_BOAS_VINDAS)
  const [modo, setModo] = useState(null) // 'importar' | 'manual'
  const [salvando, setSalvando] = useState(false)
  
  // Estados de configuração manual
  const [saldo, setSaldo] = useState(0)
  const [renda, setRenda] = useState(0)
  const [despesaFixa, setDespesaFixa] = useState(0)
  const [despesaVariavel, setDespesaVariavel] = useState(0)

  // Abre diretamente na Central se estiver retornando de um módulo
  useEffect(() => {
    if (!modo && etapa === ETAPA_BOAS_VINDAS) {
      // Verifica se está retornando de um módulo externo
      const url = new URL(window.location.href)
      const fromModulo = ['receitas', 'despesas', 'cartoes', 'beneficios', 'investimentos'].some(
        modulo => url.search.includes(modulo) || document.referrer.includes(`/${modulo}`)
      )
      if (fromModulo) {
        setModo('manual')
        setEtapa(ETAPA_CENTRAL)
      }
    }
  }, [modo, etapa])

  // Carrega dados existentes
  useEffect(() => {
    if (perfil?.saldo_base) setSaldo(Number(perfil.saldo_base))
  }, [perfil])

  async function handleEscolha(escolha) {
    setModo(escolha)
    if (escolha === 'importar') {
      setEtapa(ETAPA_IMPORTACAO)
    } else {
      setEtapa(ETAPA_CENTRAL)
    }
  }

  async function handlePular() {
    if (aoConcluir) await aoConcluir()
  }

  async function handleSalvarConfiguracao() {
    setSalvando(true)
    let receitasCriadas = 0
    let despesasCriadas = 0
    
    try {
      // Salva saldo
      if (saldo > 0) {
        await atualizarPreferenciasLimite({
          saldo_base: saldo,
          saldo_base_data: hojeISOBrasil(),
        })
      }

      // Salva renda como receita recorrente mensal (idempotente)
      if (renda > 0 && categoriasReceita.length > 0) {
        const categoriaRenda = categoriasReceita.find(c => 
          c.nome === 'Salário' || c.nome === 'Renda'
        ) || categoriasReceita[0]

        // Verifica se já existe receita do onboarding
        const { data: receitaExistente } = await supabase
          .from('receitas')
          .select('id, valor')
          .eq('usuario_id', usuario.id)
          .eq('descricao', 'Renda mensal')
          .eq('recorrente', true)
          .eq('frequencia', 'mensal')
          .maybeSingle()

        if (receitaExistente) {
          // Atualiza valor se mudou
          if (Number(receitaExistente.valor) !== renda) {
            await supabase
              .from('receitas')
              .update({ valor: renda, categoria_id: categoriaRenda.id })
              .eq('id', receitaExistente.id)
          }
          receitasCriadas++
        } else {
          // Cria nova receita
          const { error: erroReceita } = await supabase
            .from('receitas')
            .insert([{
              usuario_id: usuario.id,
              descricao: 'Renda mensal',
              valor: renda,
              data: hojeISOBrasil(),
              recorrente: true,
              frequencia: 'mensal',
              categoria_id: categoriaRenda.id,
            }])
          
          if (!erroReceita) receitasCriadas++
        }
      }

      // Salva despesas fixas como despesa recorrente mensal (idempotente)
      if (despesaFixa > 0 && categoriasDespesa.length > 0) {
        const categoriaDespesas = categoriasDespesa.find(c => 
          c.nome === 'Moradia' || c.nome === 'Contas' || c.nome === 'Despesas Fixas'
        ) || categoriasDespesa[0]

        // Verifica se já existe despesa do onboarding
        const { data: despesaExistente } = await supabase
          .from('despesas')
          .select('id, valor')
          .eq('usuario_id', usuario.id)
          .eq('descricao', 'Despesas fixas mensais')
          .eq('recorrente', true)
          .eq('frequencia', 'mensal')
          .maybeSingle()

        if (despesaExistente) {
          // Atualiza valor se mudou
          if (Number(despesaExistente.valor) !== despesaFixa) {
            await supabase
              .from('despesas')
              .update({ valor: despesaFixa, categoria_id: categoriaDespesas.id })
              .eq('id', despesaExistente.id)
          }
          despesasCriadas++
        } else {
          // Cria nova despesa
          const { error: erroDespesa } = await supabase
            .from('despesas')
            .insert([{
              usuario_id: usuario.id,
              descricao: 'Despesas fixas mensais',
              valor: despesaFixa,
              data: hojeISOBrasil(),
              recorrente: true,
              frequencia: 'mensal',
              tipo_despesa: 'fixa',
              categoria_id: categoriaDespesas.id,
            }])
          
          if (!erroDespesa) despesasCriadas++
        }
      }

      // Despesas variáveis são apenas estimativa, não cria lançamento
      // (usuário registra conforme for gastando)

      setContadores({
        receitas: receitasCriadas,
        despesas: despesasCriadas,
      })
      
      setEtapa(ETAPA_CONCLUSAO)
    } catch (err) {
      alert('Erro ao salvar: ' + (err?.message || String(err)))
    } finally {
      setSalvando(false)
    }
  }

  function handleImportacaoConcluida() {
    setEtapa(ETAPA_CONCLUSAO)
  }

  async function handleConcluir() {
    if (aoConcluir) await aoConcluir()
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
            receitas: contadores.receitas > 0 ? contadores.receitas : (receitasRes.count || 0),
            despesas: contadores.despesas > 0 ? contadores.despesas : (despesasRes.count || 0),
            cartoes: cartoes.length,
            investimentos: investimentos.length,
          })
        } catch (err) {
          console.error('Erro ao carregar resumo:', err)
        }
      }
      carregarResumo()
    }
  }, [etapa, usuario, perfil, cartoes, investimentos, contadores])

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
          <div className="text-center mb-8">
            <button
              onClick={() => setEtapa(ETAPA_BOAS_VINDAS)}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Voltar
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Configure suas finanças
            </h2>
            <p className="text-gray-600">
              Escolha os módulos que deseja configurar agora
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setEtapa(ETAPA_SALDO)}
              className="bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FFF5F7] flex items-center justify-center mb-3">
                <Wallet size={24} style={{color: '#801D39'}} />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Saldo e Contas</h3>
              <p className="text-sm text-gray-600">Seu saldo bancário inicial</p>
            </button>

            <a
              href="/receitas?origem=onboarding"
              className="bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group block"
            >
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                <ArrowRight size={24} className="text-green-600 rotate-180" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Receitas</h3>
              <p className="text-sm text-gray-600">Salários, rendas e entradas</p>
            </a>

            <a
              href="/despesas?origem=onboarding"
              className="bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group block"
            >
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                <ArrowRight size={24} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Despesas</h3>
              <p className="text-sm text-gray-600">Gastos fixos e variáveis</p>
            </a>

            <a
              href="/cartoes?origem=onboarding"
              className="bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group block"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Cartões</h3>
              <p className="text-sm text-gray-600">Cartões de crédito</p>
            </a>

            <a
              href="/beneficios?origem=onboarding"
              className="bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group block"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                <FileText size={24} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">VR/VA</h3>
              <p className="text-sm text-gray-600">Vale refeição e alimentação</p>
            </a>

            <a
              href="/investimentos?origem=onboarding"
              className="bg-white border-2 border-gray-200 hover:border-marca rounded-2xl p-6 text-left transition-all hover:shadow-lg group block"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
                <Upload size={24} className="text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Investimentos</h3>
              <p className="text-sm text-gray-600">Patrimônio investido</p>
            </a>
          </div>

          <div className="flex gap-3 mt-8">
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

  if (etapa === ETAPA_CONFIGURACAO) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuração inicial</h2>
            
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Renda mensal (opcional)
                </label>
                <InputMoeda
                  valor={renda}
                  onChangeValor={setRenda}
                  className="input text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Despesas fixas mensais (opcional)
                </label>
                <InputMoeda
                  valor={despesaFixa}
                  onChangeValor={setDespesaFixa}
                  className="input text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: aluguel, condomínio, internet
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Despesas variáveis mensais (opcional)
                </label>
                <InputMoeda
                  valor={despesaVariavel}
                  onChangeValor={setDespesaVariavel}
                  className="input text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: alimentação, transporte, lazer
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEtapa(ETAPA_BOAS_VINDAS)}
                className="btn-secondary flex-1"
              >
                Voltar
              </button>
              <button
                onClick={handleSalvarConfiguracao}
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
                    Continuar
                    <ArrowRight size={16} />
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
                  <span className="font-semibold text-blue-600">{resumo.cartoes}</span>
                </div>
              )}
              {resumo.investimentos > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Investimentos</span>
                  <span className="font-semibold text-purple-600">{resumo.investimentos}</span>
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
