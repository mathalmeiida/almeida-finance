import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserRound, Wallet, CreditCard, Rocket, ArrowLeft, ArrowRight, Loader2, UtensilsCrossed, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCartoes } from '../hooks/useCartoes'
import { useBeneficios } from '../hooks/useBeneficios'
import { useInvestimentos } from '../hooks/useInvestimentos'
import InputMoeda from '../components/InputMoeda'
import ImportacaoInteligente from './ImportacaoInteligente'
import { supabase } from '../lib/supabase'
import { CORES_CARTAO } from '../lib/coresCartao'

const OBJETIVOS = [
  { value: 'economizar', label: 'Economizar e guardar dinheiro', icon: '💰' },
  { value: 'controlar_gastos', label: 'Controlar meus gastos', icon: '📊' },
  { value: 'sair_dividas', label: 'Sair das dívidas', icon: '✅' },
  { value: 'investir', label: 'Investir meu dinheiro', icon: '📈' },
  { value: 'planejar', label: 'Planejar compras grandes', icon: '🎯' },
]

export default function OnboardingNovo() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { cartoes, adicionarCartao, carregando: carregandoCartoes } = useCartoes()
  const { beneficios, adicionar: adicionarBeneficio, carregando: carregandoBeneficios } = useBeneficios()
  const { investimentos, adicionarPosicao, carregando: carregandoInv } = useInvestimentos()
  
  const [etapa, setEtapa] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [modalImportacao, setModalImportacao] = useState(false)
  
  const [form, setForm] = useState({
    objetivos: [],
    uso_familiar: false,
    saldo_disponivel: '',
    renda_mensal: '',
    patrimonio_investido: '',
    
    cartao_nome: '',
    cartao_limite: '',
    cartao_dia_fechamento: '',
    cartao_dia_vencimento: '',
    cartao_cor: CORES_CARTAO[0],
    
    vr_saldo: '',
    va_saldo: '',
  })

  useEffect(() => {
    const chave = `almeida_onboarding_concluido_${usuario?.id}`
    const concluido = localStorage.getItem(chave)
    if (concluido) navigate('/', { replace: true })
  }, [usuario, navigate])

  function handleChange(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function toggleObjetivo(obj) {
    setForm(prev => ({
      ...prev,
      objetivos: prev.objetivos.includes(obj)
        ? prev.objetivos.filter(o => o !== obj)
        : [...prev.objetivos, obj]
    }))
  }

  async function avancar() {
    if (etapa < 4) {
      setEtapa(etapa + 1)
      return
    }
    await finalizar()
  }

  function voltar() {
    if (etapa > 1) setEtapa(etapa - 1)
  }

  function pular() {
    if (etapa < 4) setEtapa(etapa + 1)
    else finalizar()
  }

  async function finalizar() {
    setSalvando(true)
    try {
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('saldo_disponivel, renda_mensal')
        .eq('id', usuario.id)
        .single()

      const updates = {}
      if (!perfil?.saldo_disponivel && form.saldo_disponivel) {
        updates.saldo_disponivel = Number(form.saldo_disponivel)
      }
      if (!perfil?.renda_mensal && form.renda_mensal) {
        updates.renda_mensal = Number(form.renda_mensal)
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('usuarios')
          .update(updates)
          .eq('id', usuario.id)
      }

      if (form.patrimonio_investido && Number(form.patrimonio_investido) > 0) {
        const existe = investimentos.find(i => i.nome === 'Patrimônio inicial')
        if (!existe) {
          await adicionarPosicao({
            nome: 'Patrimônio inicial',
            categoria: 'outro',
            tipo: 'outro',
            valor_aplicado: Number(form.patrimonio_investido),
            valor_atual: Number(form.patrimonio_investido),
          })
        }
      }

      if (form.cartao_nome && form.cartao_limite) {
        const existe = cartoes.find(c => 
          c.nome?.toLowerCase() === form.cartao_nome.toLowerCase()
        )
        if (!existe) {
          await adicionarCartao({
            nome: form.cartao_nome,
            limite: Number(form.cartao_limite),
            dia_fechamento: Number(form.cartao_dia_fechamento) || 1,
            dia_vencimento: Number(form.cartao_dia_vencimento) || 10,
            cor: form.cartao_cor,
            ativo: true,
          })
        }
      }

      if (form.vr_saldo && Number(form.vr_saldo) > 0) {
        const existeVR = beneficios.find(b => b.tipo === 'VR')
        if (!existeVR) {
          await adicionarBeneficio({
            tipo: 'VR',
            nome: 'Vale-refeição',
            saldo_atual: Number(form.vr_saldo),
            ativo: true,
          })
        }
      }

      if (form.va_saldo && Number(form.va_saldo) > 0) {
        const existeVA = beneficios.find(b => b.tipo === 'VA')
        if (!existeVA) {
          await adicionarBeneficio({
            tipo: 'VA',
            nome: 'Vale-alimentação',
            saldo_atual: Number(form.va_saldo),
            ativo: true,
          })
        }
      }

      const chave = `almeida_onboarding_concluido_${usuario?.id}`
      localStorage.setItem(chave, 'true')
      
      navigate('/', { replace: true })
    } catch (erro) {
      console.error('Erro ao finalizar onboarding:', erro)
    } finally {
      setSalvando(false)
    }
  }

  const podeAvancar = () => {
    if (etapa === 1) return form.objetivos.length > 0
    if (etapa === 2) return form.saldo_disponivel || form.renda_mensal
    return true
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 pb-32">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-gray-500">Etapa {etapa} de 4</span>
            {etapa < 4 && (
              <button onClick={pular} className="text-sm text-marca font-medium">
                Pular
              </button>
            )}
          </div>

          <div className="flex gap-1.5 mb-8">
            {[1,2,3,4].map(i => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= etapa ? 'bg-marca' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {etapa === 1 && (
            <div>
              <div className="w-12 h-12 bg-marca/10 rounded-xl flex items-center justify-center mb-4">
                <UserRound className="text-marca" size={22} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Almeida Finance</h2>
              <p className="text-gray-600 mb-6">
                Quais são seus objetivos financeiros? Selecione todos que se aplicam.
              </p>

              <div className="space-y-2 mb-6">
                {OBJETIVOS.map(obj => (
                  <button
                    key={obj.value}
                    onClick={() => toggleObjetivo(obj.value)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                      form.objetivos.includes(obj.value)
                        ? 'border-marca bg-marca/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{obj.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{obj.label}</span>
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 p-4 bg-white rounded-xl border">
                <input
                  type="checkbox"
                  checked={form.uso_familiar}
                  onChange={(e) => handleChange('uso_familiar', e.target.checked)}
                  className="w-4 h-4 text-marca"
                />
                <span className="text-sm text-gray-700">Vou usar em conjunto com minha família</span>
              </label>
            </div>
          )}

          {etapa === 2 && (
            <div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                <Wallet className="text-green-600" size={22} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Contas e saldo</h2>
              <p className="text-gray-600 mb-6">
                Informe seu saldo disponível e renda mensal. Investimentos são opcionais.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Saldo disponível
                  </label>
                  <InputMoeda
                    valor={form.saldo_disponivel}
                    onChange={(v) => handleChange('saldo_disponivel', v)}
                    placeholder="R$ 0,00"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Renda mensal
                  </label>
                  <InputMoeda
                    valor={form.renda_mensal}
                    onChange={(v) => handleChange('renda_mensal', v)}
                    placeholder="R$ 0,00"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patrimônio investido (opcional)
                  </label>
                  <InputMoeda
                    valor={form.patrimonio_investido}
                    onChange={(v) => handleChange('patrimonio_investido', v)}
                    placeholder="R$ 0,00"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor mantido separado do saldo disponível
                  </p>
                </div>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div>
              <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center mb-4">
                <CreditCard className="text-marca" size={22} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Cartões e benefícios</h2>
              <p className="text-gray-600 mb-6">
                Cadastre seu cartão principal e benefícios VR/VA (opcional).
              </p>

              <div className="space-y-6">
                <div className="p-4 bg-white rounded-xl border">
                  <h3 className="font-medium text-gray-900 mb-3">Cartão de crédito</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={form.cartao_nome}
                      onChange={(e) => handleChange('cartao_nome', e.target.value)}
                      placeholder="Nome do cartão"
                      className="input w-full"
                    />
                    <InputMoeda
                      valor={form.cartao_limite}
                      onChange={(v) => handleChange('cartao_limite', v)}
                      placeholder="Limite"
                      className="w-full"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={form.cartao_dia_fechamento}
                        onChange={(e) => handleChange('cartao_dia_fechamento', e.target.value)}
                        placeholder="Dia fechamento"
                        min="1"
                        max="31"
                        className="input"
                      />
                      <input
                        type="number"
                        value={form.cartao_dia_vencimento}
                        onChange={(e) => handleChange('cartao_dia_vencimento', e.target.value)}
                        placeholder="Dia vencimento"
                        min="1"
                        max="31"
                        className="input"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <UtensilsCrossed size={18} />
                    Benefícios
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Vale-refeição (VR)
                      </label>
                      <InputMoeda
                        valor={form.vr_saldo}
                        onChange={(v) => handleChange('vr_saldo', v)}
                        placeholder="Saldo VR"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Vale-alimentação (VA)
                      </label>
                      <InputMoeda
                        valor={form.va_saldo}
                        onChange={(v) => handleChange('va_saldo', v)}
                        placeholder="Saldo VA"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {etapa === 4 && (
            <div>
              <div className="w-12 h-12 bg-marca/10 rounded-xl flex items-center justify-center mb-4">
                <Rocket className="text-marca" size={22} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Tudo pronto!</h2>
              <p className="text-gray-600 mb-6">
                Você pode importar extratos e faturas ou começar manualmente.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setModalImportacao(true)}
                  className="w-full btn-secondary p-4 flex items-center gap-3"
                >
                  <TrendingUp size={20} />
                  <span>Importar extratos/faturas</span>
                </button>

                <button
                  onClick={finalizar}
                  disabled={salvando}
                  className="w-full btn-primary p-4"
                >
                  {salvando ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Aguarde...</span>
                    </>
                  ) : (
                    <span>Começar a usar</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-bottom">
        <div className="max-w-2xl mx-auto flex gap-3">
          {etapa > 1 && (
            <button
              onClick={voltar}
              className="btn-secondary px-4"
              disabled={salvando}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {etapa < 4 && (
            <button
              onClick={avancar}
              disabled={!podeAvancar()}
              className="btn-primary flex-1"
            >
              <span>Continuar</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>

      {modalImportacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ImportacaoInteligente
              embutido
              onConcluir={() => {
                setModalImportacao(false)
                finalizar()
              }}
              onCancelar={() => setModalImportacao(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
