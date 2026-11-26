import React, { useState, useEffect } from 'react'
import { 
  Wallet, TrendingUp, TrendingDown, CreditCard, 
  PiggyBank, CheckCircle2, ArrowRight, ArrowLeft,
  Plus, X, Loader2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCartoes } from '../hooks/useCartoes'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { useCategorias } from '../hooks/useCategorias'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { hojeISO, formatCurrency } from '../lib/utils'
/**
 * Onboarding Simplificado - 6 Etapas
 * 
 * 1. Saldo bancário atual
 * 2. Receitas
 * 3. Despesas recorrentes
 * 4. Cartões de crédito
 * 5. Investimentos
 * 6. Revisão e conclusão
 */
// Campo monetário local: armazena valores em reais, sem separadores de milhar.
function InputMoeda({ valor, onChangeValor, permitirNegativo = false, ...props }) {
  const texto = String(valor ?? '').replace('.', ',')
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        const entrada = e.target.value.replace(/\s/g, '').replace(',', '.')
        const padrao = permitirNegativo ? /^-?\d*(\.\d{0,2})?$/ : /^\d*(\.\d{0,2})?$/
        if (padrao.test(entrada)) onChangeValor(entrada)
      }}
      onBlur={() => {
        if (valor !== '' && !Number.isFinite(Number(valor))) onChangeValor('')
        else if (valor !== '') onChangeValor(String(Number(valor)))
      }}
    />
  )
}

const ETAPAS = {
  SALDO: 'saldo',
  RECEITAS: 'receitas',
  DESPESAS: 'despesas',
  CARTOES: 'cartoes',
  INVESTIMENTOS: 'investimentos',
  REVISAO: 'revisao'
}
const ORDEM_ETAPAS = [
  ETAPAS.SALDO,
  ETAPAS.RECEITAS,
  ETAPAS.DESPESAS,
  ETAPAS.CARTOES,
  ETAPAS.INVESTIMENTOS,
  ETAPAS.REVISAO
]
const CHAVE_PROGRESSO = 'almeida_onboarding_progresso_v2'
export default function OnboardingNovo6Etapas({ aoConcluir }) {
  const { usuario } = useAuth()
  const { criar: criarCartao } = useCartoes()
  const { criar: criarInvestimento } = useInvestimentos()
  const { categorias: categoriasReceita } = useCategorias('receita')
  const { categorias: categoriasDespesa } = useCategorias('despesa')
  const [etapaAtual, setEtapaAtual] = useState(ETAPAS.SALDO)
  const [salvando, setSalvando] = useState(false)
  const [modalCartao, setModalCartao] = useState(false)
  const [modalInvestimento, setModalInvestimento] = useState(false)
  // Dados do onboarding
  const [dados, setDados] = useState({
    saldo: '',
    receitas: [],
    despesas: [],
    cartoes: [],
    investimentos: [],
    cartoes_nao_utilizo: false,
    investimentos_nao_utilizo: false,
    cartoes_importados: [],
    investimentos_importados: []
  })
  // Form de cartão
  const [formCartao, setFormCartao] = useState({
    nome: '',
    limite_total: '',
    dia_fechamento: '',
    dia_vencimento: '',
    cor: '#6366f1'
  })
  // Form de investimento
  const [formInvestimento, setFormInvestimento] = useState({
    nome: '',
    tipo: 'renda_fixa',
    valor_atual: '',
    rentabilidade_mes: ''
  })
  // Carregar progresso salvo
  useEffect(() => {
    if (!usuario?.id) return
    try {
      const chave = `${CHAVE_PROGRESSO}_${usuario.id}`
      const salvo = localStorage.getItem(chave)
      if (salvo) {
        const progresso = JSON.parse(salvo)
        if (progresso.dados) setDados(atuais => ({ ...atuais, ...progresso.dados }))
        if (ORDEM_ETAPAS.includes(progresso.etapaAtual)) setEtapaAtual(progresso.etapaAtual)
      }
    } catch (err) {
      console.error('Erro ao carregar progresso:', err)
    }
  }, [usuario?.id])
  // Salvar progresso
  function salvarProgresso(novosDados = dados, novaEtapa = etapaAtual) {
    if (!usuario?.id) return
    try {
      const chave = `${CHAVE_PROGRESSO}_${usuario.id}`
      localStorage.setItem(chave, JSON.stringify({
        dados: novosDados,
        etapaAtual: novaEtapa,
        ultimaAtualizacao: new Date().toISOString()
      }))
    } catch (err) {
      console.error('Erro ao salvar progresso:', err)
    }
  }
  // Navegação entre etapas
  function proximaEtapa(novosDados = dados) {
    const indiceAtual = ORDEM_ETAPAS.indexOf(etapaAtual)
    if (indiceAtual < ORDEM_ETAPAS.length - 1) {
      const proxima = ORDEM_ETAPAS[indiceAtual + 1]
      setEtapaAtual(proxima)
      salvarProgresso(novosDados, proxima)
    }
  }
  function etapaAnterior() {
    const indiceAtual = ORDEM_ETAPAS.indexOf(etapaAtual)
    if (indiceAtual > 0) {
      const anterior = ORDEM_ETAPAS[indiceAtual - 1]
      setEtapaAtual(anterior)
      salvarProgresso(dados, anterior)
    }
  }
  // Adicionar cartão manualmente
  async function adicionarCartaoManual() {
    if (!formCartao.nome || !formCartao.limite_total || !formCartao.dia_fechamento || !formCartao.dia_vencimento) {
      alert('Preencha todos os campos obrigatórios do cartão')
      return
    }
    try {
      const novoCartao = await criarCartao({
        nome: formCartao.nome,
        limite_total: Number(formCartao.limite_total),
        dia_fechamento: parseInt(formCartao.dia_fechamento),
        dia_vencimento: parseInt(formCartao.dia_vencimento),
        cor: formCartao.cor
      })
      const novosDados = {
        ...dados,
        cartoes: [...dados.cartoes, novoCartao],
        cartoes_nao_utilizo: false
      }
      setDados(novosDados)
      salvarProgresso(novosDados)
      setFormCartao({
        nome: '',
        limite_total: '',
        dia_fechamento: '',
        dia_vencimento: '',
        cor: '#6366f1'
      })
      setModalCartao(false)
    } catch (err) {
      console.error('Erro ao criar cartão:', err)
      alert('Erro ao cadastrar cartão. Tente novamente.')
    }
  }
  // Adicionar investimento manualmente
  async function adicionarInvestimentoManual() {
    if (!formInvestimento.nome || !formInvestimento.valor_atual) {
      alert('Preencha todos os campos obrigatórios do investimento')
      return
    }
    try {
      const novoInvestimento = await criarInvestimento({
        nome: formInvestimento.nome,
        tipo: formInvestimento.tipo,
        valor_atual: Number(formInvestimento.valor_atual),
        rentabilidade_mes: formInvestimento.rentabilidade_mes ? Number(formInvestimento.rentabilidade_mes) : null
      })
      const novosDados = {
        ...dados,
        investimentos: [...dados.investimentos, novoInvestimento],
        investimentos_nao_utilizo: false
      }
      setDados(novosDados)
      salvarProgresso(novosDados)
      setFormInvestimento({
        nome: '',
        tipo: 'renda_fixa',
        valor_atual: '',
        rentabilidade_mes: ''
      })
      setModalInvestimento(false)
    } catch (err) {
      console.error('Erro ao criar investimento:', err)
      alert('Erro ao cadastrar investimento. Tente novamente.')
    }
  }
  // Adicionar receita
  function adicionarReceita() {
    const novaReceita = {
      id: Date.now(),
      descricao: '',
      valor: '',
      recorrente: true
    }
    const novosDados = {
      ...dados,
      receitas: [...dados.receitas, novaReceita]
    }
    setDados(novosDados)
    salvarProgresso(novosDados)
  }
  // Remover receita
  function removerReceita(id) {
    const novosDados = {
      ...dados,
      receitas: dados.receitas.filter(r => r.id !== id)
    }
    setDados(novosDados)
    salvarProgresso(novosDados)
  }
  // Atualizar receita
  function atualizarReceita(id, campo, valor) {
    const novosDados = {
      ...dados,
      receitas: dados.receitas.map(r =>
        r.id === id ? { ...r, [campo]: valor } : r
      )
    }
    setDados(novosDados)
    salvarProgresso(novosDados)
  }
  // Adicionar despesa
  function adicionarDespesa() {
    const novaDespesa = {
      id: Date.now(),
      descricao: '',
      valor: '',
      recorrente: true
    }
    const novosDados = {
      ...dados,
      despesas: [...dados.despesas, novaDespesa]
    }
    setDados(novosDados)
    salvarProgresso(novosDados)
  }
  // Remover despesa
  function removerDespesa(id) {
    const novosDados = {
      ...dados,
      despesas: dados.despesas.filter(d => d.id !== id)
    }
    setDados(novosDados)
    salvarProgresso(novosDados)
  }
  // Atualizar despesa
  function atualizarDespesa(id, campo, valor) {
    const novosDados = {
      ...dados,
      despesas: dados.despesas.map(d =>
        d.id === id ? { ...d, [campo]: valor } : d
      )
    }
    setDados(novosDados)
    salvarProgresso(novosDados)
  }
  // Concluir configuração
  async function concluirConfiguracao() {
    if (!usuario?.id || salvando) return
    setSalvando(true)
    try {
      // 1. Salvar saldo inicial (apenas se informado)
      if (dados.saldo !== '' && Number.isFinite(Number(dados.saldo))) {
        const { data: saldoExistente, error: erroSaldo } = await supabase
          .from('usuarios')
          .select('saldo_inicial')
          .eq('id', usuario.id)
          .single()
        if (erroSaldo) throw erroSaldo
        if (saldoExistente?.saldo_inicial == null || Number(saldoExistente.saldo_inicial) === 0) {
          const { error: erroRPC } = await supabase.rpc('definir_saldo_inicial', {
            p_usuario_id: usuario.id,
            p_valor: Number(dados.saldo)
          })
          if (erroRPC) throw erroRPC
        }
      }
      // 2. Salvar receitas (evitar duplicações)
      if (dados.receitas.length > 0) {
        const receitasParaSalvar = dados.receitas
          .filter(r => r.descricao && r.valor)
          .map(r => ({
            usuario_id: usuario.id,
            descricao: r.descricao,
            valor: Number(r.valor),
            data: hojeISO(),
            recorrente: r.recorrente,
            categoria_id: categoriasReceita.find(c => 
              c.nome.toLowerCase().includes(r.descricao.toLowerCase().split(' ')[0])
            )?.id || null
          }))
        if (receitasParaSalvar.length > 0) {
          // Verificar duplicações antes de inserir
          const { data: receitasExistentes, error: erroConsulta } = await supabase
            .from('receitas')
            .select('descricao')
            .eq('usuario_id', usuario.id)
            .in('descricao', receitasParaSalvar.map(r => r.descricao))
          if (erroConsulta) throw erroConsulta
          const descExistentes = new Set((receitasExistentes || []).map(r => r.descricao))
          const receitasNovas = receitasParaSalvar.filter(r => !descExistentes.has(r.descricao))
          if (receitasNovas.length > 0) {
            const { error: erroInsercao } = await supabase.from('receitas').insert(receitasNovas)
            if (erroInsercao) throw erroInsercao
          }
        }
      }
      // 3. Salvar despesas (evitar duplicações)
      if (dados.despesas.length > 0) {
        const despesasParaSalvar = dados.despesas
          .filter(d => d.descricao && d.valor)
          .map(d => ({
            usuario_id: usuario.id,
            descricao: d.descricao,
            valor: Number(d.valor),
            data: hojeISO(),
            recorrente: d.recorrente,
            categoria_id: categoriasDespesa.find(c => 
              c.nome.toLowerCase().includes(d.descricao.toLowerCase().split(' ')[0])
            )?.id || null
          }))
        if (despesasParaSalvar.length > 0) {
          // Verificar duplicações
          const { data: despesasExistentes, error: erroConsulta } = await supabase
            .from('despesas')
            .select('descricao')
            .eq('usuario_id', usuario.id)
            .in('descricao', despesasParaSalvar.map(d => d.descricao))
          if (erroConsulta) throw erroConsulta
          const descExistentes = new Set((despesasExistentes || []).map(d => d.descricao))
          const despesasNovas = despesasParaSalvar.filter(d => !descExistentes.has(d.descricao))
          if (despesasNovas.length > 0) {
            const { error: erroInsercao } = await supabase.from('despesas').insert(despesasNovas)
            if (erroInsercao) throw erroInsercao
          }
        }
      }
      // 4. Cartões e investimentos já foram salvos durante o cadastro manual
      // (via criarCartao e criarInvestimento)
      // 5. Marcar onboarding como concluído (não reiniciar para usuários existentes)
      const { data: usuario_atual, error: erroUsuario } = await supabase
        .from('usuarios')
        .select('onboarding_concluido')
        .eq('id', usuario.id)
        .single()
      if (erroUsuario) throw erroUsuario
      if (!usuario_atual?.onboarding_concluido) {
        const { error: erroConclusao } = await supabase
          .from('usuarios')
          .update({ onboarding_concluido: true })
          .eq('id', usuario.id)
        if (erroConclusao) throw erroConclusao
      }
      // 6. Limpar progresso salvo
      try {
        const chave = `${CHAVE_PROGRESSO}_${usuario.id}`
        localStorage.removeItem(chave)
      } catch {}
      // 7. Callback de conclusão
      if (aoConcluir) {
        aoConcluir()
      }
    } catch (err) {
      console.error('Erro ao concluir onboarding:', err)
      alert('Erro ao salvar configurações. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }
  // Renderizar indicador de progresso
  const indiceAtual = ORDEM_ETAPAS.indexOf(etapaAtual)
  const percentualConcluido = Math.round(((indiceAtual + 1) / ORDEM_ETAPAS.length) * 100)
  return (
    <div className="min-h-screen bg-gradient-to-br from-marca/10 to-white flex flex-col">
      {/* Header com progresso */}
      <div className="bg-white border-b border-gray-200 py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold text-gray-900">Configuração inicial</h1>
            <span className="text-sm text-gray-500">
              Etapa {indiceAtual + 1} de {ORDEM_ETAPAS.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-marca h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentualConcluido}%` }}
            />
          </div>
        </div>
      </div>
      {/* Conteúdo da etapa atual */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* ETAPA 1: Saldo bancário */}
          {etapaAtual === ETAPAS.SALDO && (
            <div className="card space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-marca rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Wallet size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Qual é o seu saldo bancário atual?
                </h2>
                <p className="text-sm text-gray-500">
                  Informe quanto você tem disponível em conta corrente
                </p>
              </div>
              <div>
                <label className="label">Saldo atual (R$)</label>
                <InputMoeda
                  valor={dados.saldo}
                  permitirNegativo
                  onChangeValor={(valor) => {
                    const novosDados = { ...dados, saldo: valor }
                    setDados(novosDados)
                    salvarProgresso(novosDados)
                  }}
                  className="input text-2xl font-bold text-center"
                  placeholder="0,00"
                  autoFocus
                />
              </div>
              <button
                onClick={() => proximaEtapa()}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          {/* ETAPA 2: Receitas */}
          {etapaAtual === ETAPAS.RECEITAS && (
            <div className="space-y-4">
              <div className="card">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <TrendingUp size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Quais são suas receitas?
                  </h2>
                  <p className="text-sm text-gray-500">
                    Adicione salário, freelances e outras fontes de renda
                  </p>
                </div>
                {dados.receitas.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhuma receita adicionada ainda
                  </div>
                )}
                <div className="space-y-3">
                  {dados.receitas.map((receita) => (
                    <div key={receita.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={receita.descricao}
                          onChange={(e) => atualizarReceita(receita.id, 'descricao', e.target.value)}
                          placeholder="Ex: Salário, Freelance..."
                          className="input text-sm"
                        />
                        <InputMoeda
                          valor={receita.valor}
                          onChangeValor={(valor) => atualizarReceita(receita.id, 'valor', valor)}
                          className="input text-sm"
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <button
                        onClick={() => removerReceita(receita.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={adicionarReceita}
                  className="btn-secondary w-full mt-4 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Adicionar receita
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={etapaAnterior}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Voltar
                </button>
                <button
                  onClick={() => proximaEtapa()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  Continuar
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
          {/* ETAPA 3: Despesas */}
          {etapaAtual === ETAPAS.DESPESAS && (
            <div className="space-y-4">
              <div className="card">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <TrendingDown size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Quais são suas despesas recorrentes?
                  </h2>
                  <p className="text-sm text-gray-500">
                    Adicione aluguel, contas fixas e outras despesas mensais
                  </p>
                </div>
                {dados.despesas.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhuma despesa adicionada ainda
                  </div>
                )}
                <div className="space-y-3">
                  {dados.despesas.map((despesa) => (
                    <div key={despesa.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={despesa.descricao}
                          onChange={(e) => atualizarDespesa(despesa.id, 'descricao', e.target.value)}
                          placeholder="Ex: Aluguel, Luz, Internet..."
                          className="input text-sm"
                        />
                        <InputMoeda
                          valor={despesa.valor}
                          onChangeValor={(valor) => atualizarDespesa(despesa.id, 'valor', valor)}
                          className="input text-sm"
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <button
                        onClick={() => removerDespesa(despesa.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={adicionarDespesa}
                  className="btn-secondary w-full mt-4 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Adicionar despesa
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={etapaAnterior}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Voltar
                </button>
                <button
                  onClick={() => proximaEtapa()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  Continuar
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
          {/* ETAPA 4: Cartões */}
          {etapaAtual === ETAPAS.CARTOES && (
            <div className="space-y-4">
              <div className="card">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CreditCard size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Você possui cartões de crédito?
                  </h2>
                  <p className="text-sm text-gray-500">
                    Escolha como deseja configurar seus cartões
                  </p>
                </div>
                {/* Lista de cartões já cadastrados */}
                {dados.cartoes.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {dados.cartoes.map((cartao, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: cartao.cor }} />
                          <div>
                            <p className="font-semibold text-sm">{cartao.nome}</p>
                            <p className="text-xs text-gray-500">
                              Limite: {formatCurrency(cartao.limite_total)}
                            </p>
                          </div>
                        </div>
                        <CheckCircle2 size={20} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    onClick={() => setModalCartao(true)}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-marca hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="w-10 h-10 text-marca" />
                      <div>
                        <p className="font-semibold text-gray-900">Cadastrar manualmente</p>
                        <p className="text-sm text-gray-500">Informar limite, datas e detalhes</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      const novosDados = { ...dados, cartoes_nao_utilizo: true }
                      setDados(novosDados)
                      proximaEtapa(novosDados)
                    }}
                    disabled={dados.cartoes.length > 0}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <X className="w-10 h-10 text-gray-400" />
                      <div>
                        <p className="font-semibold text-gray-900">Não utilizo</p>
                        <p className="text-sm text-gray-500">Pular esta etapa</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={etapaAnterior}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Voltar
                </button>
                {dados.cartoes.length > 0 && (
                  <button
                    onClick={() => proximaEtapa()}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    Continuar
                    <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
          {/* ETAPA 5: Investimentos */}
          {etapaAtual === ETAPAS.INVESTIMENTOS && (
            <div className="space-y-4">
              <div className="card">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <PiggyBank size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Você possui investimentos?
                  </h2>
                  <p className="text-sm text-gray-500">
                    Escolha como deseja configurar seus investimentos
                  </p>
                </div>
                {dados.investimentos.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {dados.investimentos.map((item, idx) => (
                      <div key={item.id ?? idx} className="p-3 bg-gray-50 rounded-lg flex justify-between gap-2">
                        <span>{item.nome}</span>
                        <span>{formatCurrency(item.valor_atual)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    onClick={() => setModalInvestimento(true)}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-marca hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="w-10 h-10 text-marca" />
                      <div>
                        <p className="font-semibold text-gray-900">Cadastrar manualmente</p>
                        <p className="text-sm text-gray-500">Informar aplicações e valores</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      const novosDados = { ...dados, investimentos_nao_utilizo: true }
                      setDados(novosDados)
                      proximaEtapa(novosDados)
                    }}
                    disabled={dados.investimentos.length > 0}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <X className="w-10 h-10 text-gray-400" />
                      <div>
                        <p className="font-semibold text-gray-900">Não utilizo</p>
                        <p className="text-sm text-gray-500">Pular esta etapa</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={etapaAnterior}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Voltar
                </button>
                {dados.investimentos.length > 0 && (
                  <button onClick={() => proximaEtapa()} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    Continuar <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
          {/* ETAPA 6: Revisão */}
          {etapaAtual === ETAPAS.REVISAO && (
            <div className="space-y-4">
              <div className="card">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-marca rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Revisão da configuração
                  </h2>
                  <p className="text-sm text-gray-500">
                    Confira os dados informados antes de concluir
                  </p>
                </div>
                <div className="space-y-4">
                  {/* Saldo */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Saldo bancário</p>
                        <p className="text-lg font-bold text-gray-900">
                          {dados.saldo ? formatCurrency(Number(dados.saldo)) : 'Não informado'}
                        </p>
                      </div>
                      <Wallet className="text-marca" />
                    </div>
                  </div>
                  {/* Receitas */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm text-gray-500">Receitas cadastradas</p>
                        <p className="text-lg font-bold text-gray-900">
                          {dados.receitas.length} {dados.receitas.length === 1 ? 'receita' : 'receitas'}
                        </p>
                      </div>
                      <TrendingUp className="text-green-500" />
                    </div>
                    {dados.receitas.length > 0 && (
                      <div className="space-y-1 mt-3">
                        {dados.receitas.map(r => (
                          <div key={r.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{r.descricao}</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(Number(r.valor))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Despesas */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm text-gray-500">Despesas cadastradas</p>
                        <p className="text-lg font-bold text-gray-900">
                          {dados.despesas.length} {dados.despesas.length === 1 ? 'despesa' : 'despesas'}
                        </p>
                      </div>
                      <TrendingDown className="text-red-500" />
                    </div>
                    {dados.despesas.length > 0 && (
                      <div className="space-y-1 mt-3">
                        {dados.despesas.map(d => (
                          <div key={d.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{d.descricao}</span>
                            <span className="font-semibold text-red-600">
                              {formatCurrency(Number(d.valor))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Cartões */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Cartões de crédito</p>
                        <p className="text-lg font-bold text-gray-900">
                          {dados.cartoes_nao_utilizo ? 'Não utilizo' : `${dados.cartoes.length} cartões`}
                        </p>
                      </div>
                      <CreditCard className="text-indigo-500" />
                    </div>
                  </div>
                  {/* Investimentos */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Investimentos</p>
                        <p className="text-lg font-bold text-gray-900">
                          {dados.investimentos_nao_utilizo ? 'Não utilizo' : `${dados.investimentos.length} investimentos`}
                        </p>
                      </div>
                      <PiggyBank className="text-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={etapaAnterior}
                  disabled={salvando}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Voltar
                </button>
                <button
                  onClick={concluirConfiguracao}
                  disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {salvando ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Concluir configuração
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Modal de cadastro de cartão */}
      {modalCartao && (
        <Modal
          aberto={modalCartao}
          onFechar={() => setModalCartao(false)}
          titulo="Cadastrar cartão de crédito"
        >
          <div className="space-y-4">
            <div>
              <label className="label">Nome do cartão</label>
              <input
                type="text"
                value={formCartao.nome}
                onChange={(e) => setFormCartao({ ...formCartao, nome: e.target.value })}
                className="input"
                placeholder="Ex: Bradesco Visa, Nubank"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Limite total (R$)</label>
              <InputMoeda
                valor={formCartao.limite_total}
                onChangeValor={(valor) => setFormCartao({ ...formCartao, limite_total: valor })}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Dia de fechamento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formCartao.dia_fechamento}
                  onChange={(e) => setFormCartao({ ...formCartao, dia_fechamento: e.target.value })}
                  className="input"
                  placeholder="Ex: 20"
                />
              </div>
              <div>
                <label className="label">Dia de vencimento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formCartao.dia_vencimento}
                  onChange={(e) => setFormCartao({ ...formCartao, dia_vencimento: e.target.value })}
                  className="input"
                  placeholder="Ex: 28"
                />
              </div>
            </div>
            <div>
              <label className="label">Cor do cartão</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#22c55e'].map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setFormCartao({ ...formCartao, cor })}
                    className={`w-10 h-10 rounded-lg transition-transform ${
                      formCartao.cor === cor ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalCartao(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarCartaoManual}
                className="btn-primary flex-1"
              >
                Adicionar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Modal de cadastro de investimento */}
      {modalInvestimento && (
        <Modal
          aberto={modalInvestimento}
          onFechar={() => setModalInvestimento(false)}
          titulo="Cadastrar investimento"
        >
          <div className="space-y-4">
            <div>
              <label className="label">Nome do investimento</label>
              <input
                type="text"
                value={formInvestimento.nome}
                onChange={(e) => setFormInvestimento({ ...formInvestimento, nome: e.target.value })}
                className="input"
                placeholder="Ex: Tesouro Selic, CDB, Ações..."
                autoFocus
              />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select
                value={formInvestimento.tipo}
                onChange={(e) => setFormInvestimento({ ...formInvestimento, tipo: e.target.value })}
                className="input"
              >
                <option value="renda_fixa">Renda Fixa</option>
                <option value="renda_variavel">Renda Variável</option>
                <option value="fundo">Fundo de Investimento</option>
                <option value="previdencia">Previdência</option>
                <option value="cripto">Criptomoedas</option>
              </select>
            </div>
            <div>
              <label className="label">Valor atual (R$)</label>
              <InputMoeda
                valor={formInvestimento.valor_atual}
                onChangeValor={(valor) => setFormInvestimento({ ...formInvestimento, valor_atual: valor })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Rentabilidade mensal (%) - Opcional</label>
              <input
                type="number"
                step="0.01"
                value={formInvestimento.rentabilidade_mes}
                onChange={(e) => setFormInvestimento({ ...formInvestimento, rentabilidade_mes: e.target.value })}
                className="input"
                placeholder="Ex: 1.5"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalInvestimento(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarInvestimentoManual}
                className="btn-primary flex-1"
              >
                Adicionar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}