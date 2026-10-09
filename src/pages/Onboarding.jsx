import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, ShieldCheck, Sparkles,
  CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'
import { useCategorias } from '../hooks/useCategorias'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, CORES_TEMA } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import { hojeISO as hojeISOBrasil } from '../lib/utils'

const hojeISO = () => hojeISOBrasil()

// Opções de reserva — MESMAS do card de reserva do Dashboard. 20% é o padrão.
const OPCOES_RESERVA = [10, 15, 20, 25, 30]

// Etapas do fluxo (índices internos):
//   0 = Intro | 1 = Saldo | 2 = Renda | 3 = Despesas | 4 = Reserva | 5 = Final
const INTRO = 0
const SALDO = 1
const RENDA = 2
const DESPESAS = 3
const RESERVA = 4
const FINAL = 5

// A barra de progresso cobre apenas as 4 etapas de configuração (saldo, renda,
// despesas, reserva) — "X de 4", igual ao card da Home.
const ETAPAS_CONFIG = [SALDO, RENDA, DESPESAS, RESERVA]

// Mapeia a chave vinda do card da Home ("Complete sua configuração") para a
// etapa correspondente, para reabrir o fluxo exatamente no item pendente.
const CHAVE_PARA_ETAPA = {
  saldo: SALDO,
  renda: RENDA,
  despesas: DESPESAS,
  reserva: RESERVA,
}

// Barra de progresso enxuta (apenas as 4 etapas de configuração).
function Progresso({ etapa }) {
  const indiceConfig = ETAPAS_CONFIG.indexOf(etapa)
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {ETAPAS_CONFIG.map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            indiceConfig >= 0 && i <= indiceConfig ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// Cabeçalho padrão de cada etapa (ícone + título + subtítulo).
function CabecalhoEtapa({ icone: Icone, cor, bg, titulo, subtitulo }) {
  return (
    <>
      <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4`}>
        <Icone size={22} className={cor} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{titulo}</h2>
      {subtitulo && <p className="text-sm text-gray-500 mb-4">{subtitulo}</p>}
    </>
  )
}

// Linha de resumo da tela final.
function LinhaResumo({ label, valor, cor = 'text-gray-900' }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${cor}`}>{valor}</span>
    </div>
  )
}

export default function Onboarding({ aoConcluir, etapaInicial = '' }) {
  const { perfil, atualizarPreferenciasLimite, corTema, atualizarCorTema } = useAuth()
  // Hooks das MESMAS tabelas usadas no app — sem estrutura paralela.
  const { receitas: receitasExistentes, criar: criarReceita } = useReceitas()
  const { despesas: despesasExistentes, criar: criarDespesa } = useDespesas()
  const { categorias: categoriasReceita } = useCategorias('receita')
  const { categorias: categoriasDespesa } = useCategorias('despesa')

  const [etapa, setEtapa] = useState(INTRO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  // Guarda contra duplo clique: trava síncrona (o estado "salvando" é assíncrono
  // e pode não refletir a tempo entre dois cliques muito rápidos).
  const emGravacao = useRef(false)

  // ETAPA Saldo — pré-preenche com o saldo já informado (admin reset / revisão).
  const [saldo, setSaldo] = useState(() => Number(perfil?.saldo_base) || 0)

  // ETAPA Renda — lista local; grava só ao avançar.
  const [receitas, setReceitas] = useState([]) // { descricao, valor, categoria, data, recorrente }
  const [recForm, setRecForm] = useState({
    descricao: '', valor: 0, categoria: '', data: hojeISO(), recorrente: true,
  })

  // ETAPA Despesas — lista local.
  const [despesas, setDespesas] = useState([]) // { descricao, valor, categoria_id, data, frequencia, recorrenciaMeses }
  const [despForm, setDespForm] = useState({
    descricao: '', valor: 0, categoria_id: '', data: hojeISO(),
    frequencia: 'mensal', recorrenciaMeses: '',
  })

  // ETAPA Reserva — pré-preenche com o que já existe no perfil.
  const [reservaAtual, setReservaAtual] = useState(() => Number(perfil?.reserva_atual) || 0)
  const [reservaPct, setReservaPct] = useState(() => Number(perfil?.reserva_percentual) || 20)
  const [reservaCustom, setReservaCustom] = useState('')
  const [modoCustom, setModoCustom] = useState(() => {
    const pct = Number(perfil?.reserva_percentual) || 20
    return !OPCOES_RESERVA.includes(pct)
  })

  // Se o fluxo foi reaberto pelo card da Home apontando para um item pendente,
  // começa direto nessa etapa (sem passar pela intro). Caso contrário, intro.
  useEffect(() => {
    const alvo = CHAVE_PARA_ETAPA[etapaInicial]
    if (alvo != null) setEtapa(alvo)
    // Executa só na montagem (a etapa inicial não muda durante o fluxo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Avança para a PRÓXIMA etapa de configuração (ou para o final). Como o fluxo
  // pode ter sido iniciado no meio (card da Home), avançamos sempre em ordem.
  const avancar = () => {
    setErro('')
    setEtapa((e) => Math.min(e + 1, FINAL))
  }
  const voltar = () => {
    setErro('')
    // Volta uma etapa; da primeira etapa de config (SALDO) retorna à intro.
    setEtapa((e) => Math.max(e - 1, INTRO))
  }

  // "Pular por enquanto": avança SEM salvar nada. Não cria dados fictícios nem
  // valores zerados, não apaga o que já existe e NÃO marca a etapa como
  // respondida/concluída — ela segue pendente no progresso da Home. Usado nas
  // etapas opcionais (despesas e reserva).
  const pular = () => {
    if (salvando || emGravacao.current) return
    avancar()
  }

  // ─── ETAPA Saldo ───
  async function salvarSaldo() {
    if (emGravacao.current) return
    emGravacao.current = true
    const valor = Number(saldo) || 0
    setSalvando(true); setErro('')
    try {
      // Grava mesmo que seja 0 (o usuário pode realmente estar zerado hoje).
      await atualizarPreferenciasLimite({ saldo_base: valor, saldo_base_data: hojeISO() })
      avancar()
    } catch {
      setErro('Não foi possível salvar o saldo. Tente novamente.')
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA Renda ───
  // Adiciona a renda digitada à lista local. Retorna true se adicionou.
  function adicionarReceitaLocal() {
    const valor = Number(recForm.valor) || 0
    if (!recForm.descricao.trim()) { setErro('Dê um nome à receita (ex.: Salário).'); return false }
    if (valor <= 0) { setErro('Informe um valor de receita maior que zero.'); return false }
    setErro('')
    setReceitas(prev => [...prev, {
      descricao: recForm.descricao.trim(),
      valor,
      categoria: recForm.categoria || null,
      data: recForm.data || hojeISO(),
      recorrente: !!recForm.recorrente,
    }])
    setRecForm({ descricao: '', valor: 0, categoria: '', data: hojeISO(), recorrente: true })
    return true
  }
  function removerReceitaLocal(i) {
    setReceitas(prev => prev.filter((_, idx) => idx !== i))
  }
  async function salvarReceitas() {
    if (emGravacao.current) return
    // CORREÇÃO DO BUG DE AVANÇO: se o usuário preencheu a renda mas NÃO clicou
    // em "Adicionar", nós a incluímos automaticamente aqui — antes era perdida
    // silenciosamente e o fluxo "pulava" a etapa sem salvar nada.
    let lista = receitas
    const temFormPreenchido = recForm.descricao.trim() || (Number(recForm.valor) || 0) > 0
    if (temFormPreenchido) {
      const valor = Number(recForm.valor) || 0
      if (!recForm.descricao.trim()) { setErro('Dê um nome à receita (ex.: Salário).'); return }
      if (valor <= 0) { setErro('Informe um valor de receita maior que zero.'); return }
      lista = [...receitas, {
        descricao: recForm.descricao.trim(),
        valor,
        categoria: recForm.categoria || null,
        data: recForm.data || hojeISO(),
        recorrente: !!recForm.recorrente,
      }]
    }

    // Nenhuma renda informada: segue adiante (etapa opcional).
    if (lista.length === 0) { avancar(); return }

    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      // Grava cada receita com a MESMA função/estrutura da tela Receitas.
      // await em sequência garante que o salvamento terminou ANTES de avançar.
      for (const r of lista) {
        await criarReceita({
          descricao: r.descricao,
          valor: r.valor,
          data: r.data,
          recorrente: r.recorrente,
          categoria: r.categoria,
        })
      }
      // Só limpa a lista e avança APÓS gravar tudo com sucesso.
      setReceitas([])
      setRecForm({ descricao: '', valor: 0, categoria: '', data: hojeISO(), recorrente: true })
      avancar()
    } catch (e) {
      // NÃO avança em silêncio: mostra a mensagem clara pedida no requisito.
      setErro(e?.message
        ? `Não foi possível salvar sua renda. Tente novamente. (${e.message})`
        : 'Não foi possível salvar sua renda. Tente novamente.')
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA Despesas ───
  function adicionarDespesaLocal() {
    const valor = Number(despForm.valor) || 0
    if (!despForm.descricao.trim()) { setErro('Dê um nome à despesa (ex.: Aluguel).'); return false }
    if (valor <= 0) { setErro('Informe um valor de despesa maior que zero.'); return false }
    setErro('')
    setDespesas(prev => [...prev, {
      descricao: despForm.descricao.trim(),
      valor,
      categoria_id: despForm.categoria_id || null,
      data: despForm.data || hojeISO(),
      frequencia: despForm.frequencia,
      recorrenciaMeses: despForm.recorrenciaMeses,
    }])
    setDespForm({ descricao: '', valor: 0, categoria_id: '', data: hojeISO(), frequencia: 'mensal', recorrenciaMeses: '' })
    return true
  }
  function removerDespesaLocal(i) {
    setDespesas(prev => prev.filter((_, idx) => idx !== i))
  }
  async function salvarDespesas() {
    if (emGravacao.current) return
    // Mesma correção da renda: inclui a despesa digitada mas não "adicionada".
    let lista = despesas
    const temFormPreenchido = despForm.descricao.trim() || (Number(despForm.valor) || 0) > 0
    if (temFormPreenchido) {
      const valor = Number(despForm.valor) || 0
      if (!despForm.descricao.trim()) { setErro('Dê um nome à despesa (ex.: Aluguel).'); return }
      if (valor <= 0) { setErro('Informe um valor de despesa maior que zero.'); return }
      lista = [...despesas, {
        descricao: despForm.descricao.trim(),
        valor,
        categoria_id: despForm.categoria_id || null,
        data: despForm.data || hojeISO(),
        frequencia: despForm.frequencia,
        recorrenciaMeses: despForm.recorrenciaMeses,
      }]
    }

    if (lista.length === 0) { avancar(); return }

    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      for (const d of lista) {
        const cat = categoriasDespesa.find(c => c.id === d.categoria_id)
        // Classificação automática fixa/variável — MESMA lógica do app.
        const tipo_despesa = classificarDespesa({
          descricao: d.descricao,
          categoria: cat?.nome || '',
        })
        // Frequência: mensal (sem fim) ou por_meses (duração definida).
        let freq = d.frequencia
        let recorrencia_meses = null
        if (d.frequencia === 'mensal' && Number(d.recorrenciaMeses) > 0) {
          freq = 'por_meses'
          recorrencia_meses = Number(d.recorrenciaMeses)
        }
        const recorrente = freq !== 'nao_repete'
        await criarDespesa({
          descricao: d.descricao,
          valor: d.valor,
          data: d.data,
          recorrente,
          frequencia: freq,
          recorrencia_meses,
          categoria_id: d.categoria_id,
          tipo_despesa,
        })
      }
      setDespesas([])
      setDespForm({ descricao: '', valor: 0, categoria_id: '', data: hojeISO(), frequencia: 'mensal', recorrenciaMeses: '' })
      avancar()
    } catch (e) {
      setErro(e?.message
        ? `Não foi possível salvar suas despesas. Tente novamente. (${e.message})`
        : 'Não foi possível salvar suas despesas. Tente novamente.')
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA Reserva ───
  async function salvarReserva() {
    if (emGravacao.current) return
    let pct = reservaPct
    if (modoCustom) {
      pct = parseInt(reservaCustom, 10)
      if (!(pct >= 0 && pct <= 100)) { setErro('Informe um percentual entre 0 e 100.'); return }
    }
    const valorReserva = Number(reservaAtual) || 0
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      // Grava o percentual, o valor (R$ 0,00 é VÁLIDO: o usuário pode não ter
      // reserva) e o marcador "reserva_configurada = true" — este distingue
      // "respondeu R$ 0,00" de "ainda não respondeu". Se a coluna ainda não
      // existir no banco (migration não aplicada), tenta de novo sem ela para
      // não travar o fluxo.
      try {
        await atualizarPreferenciasLimite({
          reserva_percentual: pct,
          reserva_atual: valorReserva,
          reserva_configurada: true,
        })
      } catch (eInterno) {
        const msg = String(eInterno?.message || '').toLowerCase()
        const colunaAusente =
          msg.includes('reserva_configurada') ||
          msg.includes('column') || msg.includes('coluna') || msg.includes('schema cache')
        if (!colunaAusente) throw eInterno
        // Fallback: grava sem o marcador (progresso cai no retrocompat valor>0).
        await atualizarPreferenciasLimite({
          reserva_percentual: pct,
          reserva_atual: valorReserva,
        })
      }
      avancar()
    } catch (e) {
      setErro(e?.message
        ? `Não foi possível salvar sua reserva. Tente novamente. (${e.message})`
        : 'Não foi possível salvar sua reserva. Tente novamente.')
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  async function finalizar() {
    if (emGravacao.current) return
    emGravacao.current = true
    setSalvando(true)
    try {
      await aoConcluir?.() // marca onboarding_concluido = true e volta à Home
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── Resumo da tela final ───
  // Soma o que foi configurado AGORA + o que já existia (admin reset / revisão),
  // lendo das mesmas tabelas do app, para o resumo refletir o estado real.
  const resumo = useMemo(() => {
    const pctCustom = modoCustom ? (parseInt(reservaCustom, 10) || 0) : reservaPct

    const rendaMensalNova = receitas
      .filter(r => r.recorrente)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
    const rendaMensalExistente = (receitasExistentes || [])
      .filter(r => r.recorrente)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
    const rendaMensal = rendaMensalNova + rendaMensalExistente

    const despesasNovas = despesas
      .filter(d => d.frequencia !== 'nao_repete')
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)
    const despesasExistRecorrentes = (despesasExistentes || [])
      .filter(d => d.recorrente)
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)
    const despesasRecorrentes = despesasNovas + despesasExistRecorrentes

    const reservaPlanejada = rendaMensal * (pctCustom / 100)
    const disponivelEstimado = rendaMensal - despesasRecorrentes - reservaPlanejada

    return {
      saldo: Number(saldo) || 0,
      rendaMensal,
      despesasRecorrentes,
      reservaPlanejada,
      disponivelEstimado,
      pct: pctCustom,
    }
  }, [saldo, receitas, despesas, receitasExistentes, despesasExistentes, reservaPct, reservaCustom, modoCustom])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          {/* A barra de progresso só aparece nas etapas de configuração. */}
          {ETAPAS_CONFIG.includes(etapa) && <Progresso etapa={etapa} />}

          {/* ─── INTRO ─── */}
          {etapa === INTRO && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={30} className="text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Vamos configurar seu Almeida Finance
              </h1>
              <p className="text-sm text-gray-500 mb-5">
                Leva poucos minutos. Essas informações serão usadas para calcular seu
                orçamento, gasto diário, projeções e ajudar nas suas decisões financeiras.
              </p>

              {/* 1ª etapa: cor do tema (antes das informações financeiras).
                  Cartões de seleção com círculo colorido + indicador do escolhido.
                  Aplica na hora e salva em perfis.cor_tema (via atualizarCorTema). */}
              <div className="text-left mb-6">
                <p className="label mb-2">Escolha a cor do app</p>
                <div className="grid grid-cols-2 gap-2">
                  {CORES_TEMA.map(op => {
                    const ativo = corTema === op.value
                    return (
                      <button
                        key={op.value}
                        type="button"
                        onClick={() => atualizarCorTema(op.value)}
                        aria-pressed={ativo}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                          ativo ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: op.hex }}
                        >
                          {ativo && <CheckCircle2 size={15} className="text-white" />}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{op.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => setEtapa(SALDO)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Começar <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ─── ETAPA 1 — Saldo atual ─── */}
          {etapa === SALDO && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={Wallet} cor="text-blue-600" bg="bg-blue-50"
                titulo="Quanto você tem disponível hoje?"
                subtitulo="É o dinheiro que você tem disponível agora. Esse valor será o ponto de partida das suas projeções."
              />
              <label className="label">Saldo atual (R$)</label>
              <InputMoeda
                valor={saldo} onChangeValor={setSaldo}
                className="input text-2xl font-bold text-center py-3" prefixo={null} autoFocus
              />
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={salvarSaldo} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 2 — Renda ─── */}
          {etapa === RENDA && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={TrendingUp} cor="text-green-600" bg="bg-green-50"
                titulo="Quanto você recebe?"
                subtitulo="Salário, freelance, renda extra... Informe nome, valor, dia de recebimento e se repete todo mês."
              />

              {receitas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {receitas.map((r, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">
                        {r.descricao}
                        {r.recorrente && <span className="text-xs text-blue-500 ml-1">• mensal</span>}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(r.valor)}</span>
                        <button onClick={() => removerReceitaLocal(i)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                <input className="input" placeholder="Nome da receita (ex.: Salário)"
                  value={recForm.descricao}
                  onChange={(e) => setRecForm(p => ({ ...p, descricao: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <InputMoeda valor={recForm.valor}
                    onChangeValor={(n) => setRecForm(p => ({ ...p, valor: n }))}
                    className="input" prefixo={null} />
                  <input type="date" className="input" value={recForm.data}
                    onChange={(e) => setRecForm(p => ({ ...p, data: e.target.value }))} />
                </div>
                <p className="text-[11px] text-gray-400 -mt-1">O dia da data é usado como seu dia de recebimento.</p>
                <select className="input" value={recForm.categoria}
                  onChange={(e) => setRecForm(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categoriasReceita.map(c => <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setRecForm(p => ({ ...p, recorrente: true }))}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      recForm.recorrente ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}>
                    Recebo todo mês
                  </button>
                  <button type="button"
                    onClick={() => setRecForm(p => ({ ...p, recorrente: false }))}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      !recForm.recorrente ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}>
                    Só uma vez
                  </button>
                </div>
              </div>
              <button onClick={adicionarReceitaLocal}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                <Plus size={15} /> Adicionar outra renda
              </button>
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarReceitas} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Salvar e continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 3 — Despesas recorrentes ─── */}
          {etapa === DESPESAS && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={TrendingDown} cor="text-red-500" bg="bg-red-50"
                titulo="Quais contas você paga todos os meses?"
                subtitulo="Aluguel, água, energia, internet, celular, faculdade, assinaturas... A classificação fixa/variável é automática."
              />

              {despesas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {despesas.map((d, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">{d.descricao}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-red-500">{formatCurrency(d.valor)}</span>
                        <button onClick={() => removerDespesaLocal(i)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                <input className="input" placeholder="Nome da despesa (ex.: Aluguel)"
                  value={despForm.descricao}
                  onChange={(e) => setDespForm(p => ({ ...p, descricao: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <InputMoeda valor={despForm.valor}
                    onChangeValor={(n) => setDespForm(p => ({ ...p, valor: n }))}
                    className="input" prefixo={null} />
                  <input type="date" className="input" value={despForm.data}
                    onChange={(e) => setDespForm(p => ({ ...p, data: e.target.value }))} />
                </div>
                <p className="text-[11px] text-gray-400 -mt-1">O dia da data é usado como vencimento.</p>
                <select className="input" value={despForm.categoria_id}
                  onChange={(e) => setDespForm(p => ({ ...p, categoria_id: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categoriasDespesa.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                </select>
                <select className="input" value={despForm.frequencia}
                  onChange={(e) => setDespForm(p => ({ ...p, frequencia: e.target.value }))}>
                  <option value="nao_repete">Não repete (só uma vez)</option>
                  <option value="mensal">Repete todo mês</option>
                  <option value="semanal">Toda semana</option>
                  <option value="diaria">Todo dia</option>
                </select>
                {despForm.frequencia === 'mensal' && (
                  <input className="input" type="number" min="1" max="120" inputMode="numeric"
                    placeholder="Por quantos meses? (deixe vazio p/ sem fim)"
                    value={despForm.recorrenciaMeses}
                    onChange={(e) => setDespForm(p => ({ ...p, recorrenciaMeses: e.target.value }))} />
                )}
              </div>
              <button onClick={adicionarDespesaLocal}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                <Plus size={15} /> Adicionar outra despesa
              </button>
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarDespesas} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Salvar e continuar <ArrowRight size={16} /></>}
                </button>
              </div>

              {/* "Pular por enquanto" — etapa de despesas é opcional. Avança sem
                  criar nada; o progresso continua indicando despesas pendentes. */}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={pular}
                  disabled={salvando}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50"
                >
                  Pular por enquanto
                </button>
                <p className="text-xs text-gray-400 mt-1">Você poderá adicionar suas despesas depois.</p>
              </div>
            </div>
          )}

          {/* ─── ETAPA 4 — Reserva de emergência ─── */}
          {etapa === RESERVA && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={ShieldCheck} cor="text-amber-600" bg="bg-amber-50"
                titulo="Quanto você já possui de reserva de emergência?"
                subtitulo="Informe quanto já tem guardado e quanto da sua renda deseja reservar por mês."
              />

              <label className="label">Reserva atual (R$)</label>
              <InputMoeda valor={reservaAtual} onChangeValor={setReservaAtual}
                className="input mb-4" prefixo={null} />

              <label className="label">Quanto da sua renda deseja reservar por mês?</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {OPCOES_RESERVA.map(opt => {
                  const ativo = !modoCustom && reservaPct === opt
                  return (
                    <button key={opt}
                      onClick={() => { setModoCustom(false); setReservaPct(opt) }}
                      className={`relative py-3 rounded-lg text-sm font-semibold border transition-colors ${
                        ativo ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}>
                      {opt}%
                      {opt === 20 && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-amber-500 text-white px-1.5 rounded-full whitespace-nowrap">
                          padrão
                        </span>
                      )}
                    </button>
                  )
                })}
                <button
                  onClick={() => setModoCustom(true)}
                  className={`py-3 rounded-lg text-sm font-semibold border transition-colors ${
                    modoCustom ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}>
                  Outro
                </button>
              </div>

              {modoCustom && (
                <input className="input" type="number" min="0" max="100" autoFocus
                  value={reservaCustom} onChange={(e) => setReservaCustom(e.target.value)}
                  placeholder="Percentual personalizado (%)" />
              )}

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarReserva} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>

              {/* "Pular por enquanto" — reserva é opcional. Importante: informar
                  R$ 0,00 e clicar em "Continuar" É uma resposta válida (conclui a
                  etapa). "Pular" NÃO conclui — segue pendente no progresso. */}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={pular}
                  disabled={salvando}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50"
                >
                  Pular por enquanto
                </button>
                <p className="text-xs text-gray-400 mt-1">Você poderá configurar sua reserva depois.</p>
              </div>
            </div>
          )}

          {/* ─── FINALIZAÇÃO ─── */}
          {etapa === FINAL && (
            <div className="py-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={30} className="text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">🎉 Seu Almeida Finance está pronto</h1>
                <p className="text-sm text-gray-500 mb-5">
                  Confira o resumo e entre no app para acompanhar tudo em tempo real.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-2 mb-5">
                <LinhaResumo label="Saldo atual" valor={formatCurrency(resumo.saldo)} />
                <LinhaResumo label="Renda mensal" valor={formatCurrency(resumo.rendaMensal)} cor="text-green-600" />
                <LinhaResumo label="Despesas recorrentes" valor={formatCurrency(resumo.despesasRecorrentes)} cor="text-red-500" />
                <LinhaResumo label={`Reserva planejada (${resumo.pct}%)`} valor={formatCurrency(resumo.reservaPlanejada)} cor="text-amber-600" />
                <LinhaResumo
                  label="Disponível estimado"
                  valor={formatCurrency(resumo.disponivelEstimado)}
                  cor={resumo.disponivelEstimado >= 0 ? 'text-gray-900' : 'text-red-600'}
                />
              </div>

              <button onClick={finalizar} disabled={salvando}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {salvando ? <><Loader2 size={15} className="animate-spin" /> Abrindo...</> : <>Ir para minha Home <ArrowRight size={16} /></>}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Almeida Finance</p>
      </div>
    </div>
  )
}
