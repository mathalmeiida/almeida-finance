import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, ShieldCheck, Sparkles,
  CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, UtensilsCrossed,
  CreditCard, ShoppingBag, Pencil,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'
import { useCategorias } from '../hooks/useCategorias'
import SeletorCategoriaModerno from '../components/SeletorCategoriaModerno'
import { useCartoes } from '../hooks/useCartoes'
import { useBeneficios } from '../hooks/useBeneficios'
import InputMoeda from '../components/InputMoeda'
import Apresentacao from '../components/Apresentacao'
import { formatCurrency, CORES_TEMA } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import { hojeISO as hojeISOBrasil } from '../lib/utils'

const hojeISO = () => hojeISOBrasil()

// Opções de reserva — MESMAS do card de reserva do Dashboard. 20% é o padrão.
const OPCOES_RESERVA = [10, 15, 20, 25, 30]

// Formas de pagamento oferecidas no onboarding. Lista LOCAL (não usa a
// FORMAS_PAGAMENTO global de utils.js) porque aqui incluímos "dinheiro", "VR" e
// "VA", que o cadastro geral de despesas não lista. Os VALUES são strings
// gravadas em despesas.forma_pagamento e resolvidas por formaPagamentoLabel
// nas telas (vr/va têm label próprio adiante). Nenhuma destas formas cria
// fatura, compra em compras_cartao ou movimentação de benefício: a despesa é
// sempre apenas uma linha em public.despesas (contagem única no limite diário).
const FORMAS_PAGAMENTO_ONBOARDING = [
  { value: 'pix',               icone: '⚡', label: 'Pix' },
  { value: 'debito_automatico', icone: '🏦', label: 'Débito em conta' },
  { value: 'cartao_credito',    icone: '💳', label: 'Cartão de crédito' },
  { value: 'dinheiro',          icone: '💵', label: 'Dinheiro' },
  { value: 'boleto',            icone: '🧾', label: 'Boleto' },
  { value: 'vr',                icone: '🍽️', label: 'Vale-refeição (VR)' },
  { value: 'va',                icone: '🛒', label: 'Vale-alimentação (VA)' },
]

// Label curto da forma de pagamento para exibir na lista local da etapa de
// despesas (resolve inclusive vr/va, que não existem na lista global).
const labelFormaOnboarding = (value) =>
  FORMAS_PAGAMENTO_ONBOARDING.find(f => f.value === value)?.label || ''

// Etapas do fluxo (índices internos):
//   0 = Intro | 1 = Saldo | 2 = Renda | 3 = Despesas | 4 = Cartões |
//   5 = Benefícios (VR/VA) | 6 = Reserva | 7 = Final
// CARTOES e BENEFICIOS são etapas OPCIONAIS (podem ser puladas) e NÃO entram
// na barra de progresso "X de 4" (que cobre só saldo/renda/despesas/reserva).
// Opções e rótulo da recorrência de RECEITAS (reutilizadas no form e na lista).
const FREQUENCIAS_RECEITA = [
  { value: 'nao_repete',    label: 'Uma única vez' },
  { value: 'semanal',       label: 'Semanalmente' },
  { value: 'quinzenal',     label: 'A cada 15 dias' },
  { value: 'mensal',        label: 'Mensalmente' },
  { value: 'por_meses',     label: 'A cada X meses' },
  { value: 'personalizado', label: 'Personalizado' },
]
const labelFrequenciaReceita = (freq) => {
  const f = freq || 'mensal'
  if (f === 'nao_repete') return 'uma vez'
  return (FREQUENCIAS_RECEITA.find(o => o.value === f)?.label || f).toLowerCase()
}

const INTRO = 0
const SALDO = 1
const RENDA = 2
const DESPESAS = 3
const CARTOES = 4
const BENEFICIOS = 5
const RESERVA = 6
const FINAL = 7

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
  const { usuario, perfil, atualizarPreferenciasLimite, corTema, atualizarCorTema } = useAuth()
  // Hooks das MESMAS tabelas usadas no app — sem estrutura paralela.
  const { receitas: receitasExistentes, criar: criarReceita, atualizar: atualizarReceita } = useReceitas()
  const { despesas: despesasExistentes, criar: criarDespesa, atualizar: atualizarDespesa, remover: removerDespesa, carregando: carregandoDespesas, erro: erroCarregamentoDespesas, recarregar: recarregarDespesas } = useDespesas()
  const { categorias: categoriasReceita } = useCategorias('receita')
  const { categorias: categoriasDespesa } = useCategorias('despesa')
  // Cartões já cadastrados — usados para vincular uma despesa paga no cartão de
  // crédito (etapa Despesas) e listados na etapa Cartões. "criar" grava um novo
  // cartão (mesma função/tabela da página Cartões, sem estrutura paralela).
  const { cartoes, criar: criarCartao, atualizar: atualizarCartao, remover: removerCartao } = useCartoes()
  // Benefícios (VR/VA) — "criarBeneficio" grava na mesma tabela/hook da aba
  // Benefícios. Usado na etapa Benefícios do onboarding.
  const { beneficios, criarBeneficio, atualizarBeneficio, removerBeneficio, saldoDoBeneficio } = useBeneficios()

  const [etapa, setEtapa] = useState(INTRO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Apresentação inicial (3 telas) — mostrada UMA VEZ por usuário, antes do
  // fluxo de configuração. NÃO aparece quando o onboarding é reaberto apontando
  // para uma etapa específica (card da Home / "refazer"), pois aí o usuário já
  // conhece o app. Preferência por usuário no localStorage (robusta e sem
  // depender do banco). Só visual — não toca em dados.
  //
  // IMPORTANTE: a flag é SEMPRE chaveada pelo id REAL do usuário. Nunca usamos
  // uma chave "anon": se o id ainda não chegou, NÃO ocultamos a apresentação
  // (preferimos exibi-la a escondê-la por engano) e NÃO gravamos nada — assim
  // um usuário não "herda" o estado de outro nem a marca de uma montagem sem id.
  const chaveApresentacao = (id) => `almeida_apresentacao_vista_${id}`
  const jaViuApresentacao = (id) => {
    if (!id) return false
    try { return localStorage.getItem(chaveApresentacao(id)) === '1' } catch { return false }
  }
  const [mostrarApresentacao, setMostrarApresentacao] = useState(() => {
    if (etapaInicial) return false            // reabertura direcionada: pula
    return !jaViuApresentacao(usuario?.id)    // sem id → mostra (não esconde à toa)
  })
  // Quando o id do usuário chega depois da 1ª montagem, reavalia: se ele JÁ viu
  // a apresentação (flag gravada), oculta; caso contrário, mantém exibindo.
  useEffect(() => {
    if (etapaInicial) return
    if (usuario?.id && jaViuApresentacao(usuario.id)) setMostrarApresentacao(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])
  const concluirApresentacao = () => {
    // Só grava a flag quando há id real — nunca sob chave "anon".
    if (usuario?.id) {
      try { localStorage.setItem(chaveApresentacao(usuario.id), '1') } catch { /* ignora */ }
    }
    setMostrarApresentacao(false)
  }
  // Guarda contra duplo clique: trava síncrona (o estado "salvando" é assíncrono
  // e pode não refletir a tempo entre dois cliques muito rápidos).
  const emGravacao = useRef(false)

  // ETAPA Saldo — só PRÉ-PREENCHE quando o usuário JÁ configurou o saldo
  // (edição). Para quem nunca informou (saldo_base = null, inclusive após
  // "zerar dados"), inicia VAZIO — o campo mostra apenas o placeholder R$ 0,00
  // e nada é gravado sem o usuário informar.
  const [saldo, setSaldo] = useState(() =>
    perfil?.saldo_base != null ? Number(perfil.saldo_base) : '')

  // ETAPA Renda — lista local; grava só ao avançar. Campos monetários começam
  // VAZIOS ('') para exibir o placeholder, nunca "R$ 0,00" preenchido.
  const [receitas, setReceitas] = useState([]) // itens locais (podem ter id se já salvos)
  const [recForm, setRecForm] = useState({
    descricao: '', valor: '', categoria: '', data: hojeISO(),
    // Recorrência rica (espelha despesas): frequencia + término opcional.
    frequencia: 'mensal',       // nao_repete | semanal | quinzenal | mensal | por_meses | personalizado
    recorrenciaMeses: '',       // intervalo em meses (por_meses/personalizado)
    termino: 'sem_fim',         // sem_fim | ocorrencias | data
    ocorrencias: '',            // nº de recebimentos (termino = ocorrencias)
    dataFim: '',                // data final (termino = data)
  })
  // Índice do item em EDIÇÃO na lista local (null = adicionando novo).
  const [recEditIdx, setRecEditIdx] = useState(null)
  // Rehidrata a lista local com as receitas JÁ salvas (ao voltar à etapa),
  // evitando duplicação: itens com id não são recriados no salvar.
  const [recHidratado, setRecHidratado] = useState(false)
  useEffect(() => {
    if (recHidratado) return
    if (receitasExistentes && receitasExistentes.length > 0) {
      setReceitas(receitasExistentes.map(r => ({
        id: r.id,
        descricao: r.descricao,
        valor: Number(r.valor) || 0,
        categoria: r.categoria || null,
        data: r.data,
        frequencia: r.frequencia || (r.recorrente ? (r.recorrencia_meses != null ? 'por_meses' : 'mensal') : 'nao_repete'),
        recorrencia_meses: r.recorrencia_meses ?? null,
        ocorrencias: r.ocorrencias ?? null,
        data_fim: r.data_fim ?? null,
      })))
      setRecHidratado(true)
    }
  }, [receitasExistentes, recHidratado])

  // ETAPA Despesas — lista local.
  const [despesas, setDespesas] = useState([]) // { descricao, valor, categoria_id, data, frequencia, recorrenciaMeses }
  const [despForm, setDespForm] = useState({
    descricao: '', valor: '', categoria_id: '', data: hojeISO(),
    frequencia: 'mensal', recorrenciaMeses: '',
    forma_pagamento: '', cartao_id: '',
  })

  const [despEditIdx, setDespEditIdx] = useState(null)
  const [despHidratado, setDespHidratado] = useState(false)
  useEffect(() => {
    if (despHidratado || carregandoDespesas || erroCarregamentoDespesas || !usuario?.id) return
    // A lista do hook é a fonte dos registros já salvos.
    setDespesas(anteriores => {
      if (anteriores.length) return anteriores
      return (despesasExistentes || []).map(d => ({
        id: d.id, descricao: d.descricao, valor: Number(d.valor) || 0,
        categoria_id: d.categoria_id || '', data: d.data,
        frequencia: d.frequencia === 'por_meses' ? 'mensal' :
          (d.frequencia || (d.recorrente ? 'mensal' : 'nao_repete')),
        recorrenciaMeses: d.frequencia === 'por_meses' ||
          (!d.frequencia && d.recorrencia_meses != null)
          ? String(d.recorrencia_meses || '') : '',
        forma_pagamento: d.forma_pagamento || '', cartao_id: d.cartao_id || '',
      }))
    })
    setDespHidratado(true)
  }, [carregandoDespesas, erroCarregamentoDespesas, despesasExistentes, despHidratado, usuario?.id])

  // ETAPA Cartões — formulário local de um cartão (gravado ao avançar).
  const [cartaoForm, setCartaoForm] = useState({
    nome: '', banco: '', limite_total: '', dia_fechamento: '', dia_vencimento: '',
  })
  const [cartaoEditId, setCartaoEditId] = useState(null)

  // ETAPA Benefícios — formulário local de um benefício VR/VA. Começa VAZIO e
  // SEM valor; VR e VA são opcionais e independentes (nada é pré-selecionado
  // com valor para novos usuários). 'tipo' é só a aba ativa do formulário.
  const [beneficioForm, setBeneficioForm] = useState({
    nome: '', tipo: 'VR', saldo_inicial: '',
    recarga_valor: '', recarga_dia: '', recarga_recorrente: false,
  })
  const [beneficioEditId, setBeneficioEditId] = useState(null)

  // ETAPA Reserva — só pré-preenche o VALOR quando o usuário já respondeu a
  // etapa (reserva_configurada); senão inicia VAZIO (placeholder R$ 0,00).
  const [reservaAtual, setReservaAtual] = useState(() =>
    perfil?.reserva_configurada ? (Number(perfil?.reserva_atual) || 0) : '')
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
  // Normaliza o form em um ITEM local (frequência + término). Mantém o booleano
  // "recorrente" em sincronia (recorrente = frequência != 'nao_repete') para a
  // retrocompatibilidade e para a tela de Receitas/projeção reconhecerem.
  function itemReceitaDoForm() {
    const freq = recForm.frequencia
    const recorrente = freq !== 'nao_repete'
    const ehMensalMultiplo = freq === 'por_meses' || freq === 'personalizado'
    const recorrencia_meses = ehMensalMultiplo
      ? Math.max(1, parseInt(recForm.recorrenciaMeses, 10) || 1)
      : null
    // Término só se aplica a receitas recorrentes.
    let ocorrencias = null, data_fim = null
    if (recorrente) {
      if (recForm.termino === 'ocorrencias') ocorrencias = Math.max(1, parseInt(recForm.ocorrencias, 10) || 1)
      else if (recForm.termino === 'data') data_fim = recForm.dataFim || null
    }
    return {
      descricao: recForm.descricao.trim(),
      valor: Number(recForm.valor) || 0,
      categoria: recForm.categoria || null,
      data: recForm.data || hojeISO(),
      recorrente,
      frequencia: freq,
      recorrencia_meses,
      ocorrencias,
      data_fim,
    }
  }
  function limparRecForm() {
    setRecForm({ descricao: '', valor: '', categoria: '', data: hojeISO(),
      frequencia: 'mensal', recorrenciaMeses: '', termino: 'sem_fim', ocorrencias: '', dataFim: '' })
    setRecEditIdx(null)
  }
  function validarRecForm() {
    const valor = Number(recForm.valor) || 0
    if (!recForm.descricao.trim()) { setErro('Dê um nome à receita (ex.: Salário).'); return false }
    if (valor <= 0) { setErro('Informe um valor de receita maior que zero.'); return false }
    return true
  }
  // Adiciona OU atualiza (quando em edição) o item na lista local.
  function adicionarReceitaLocal() {
    if (!validarRecForm()) return false
    setErro('')
    const item = itemReceitaDoForm()
    setReceitas(prev => {
      if (recEditIdx != null) {
        // Preserva o id (se já salvo) ao editar.
        const copia = [...prev]
        copia[recEditIdx] = { ...item, id: prev[recEditIdx]?.id }
        return copia
      }
      return [...prev, item]
    })
    limparRecForm()
    return true
  }
  // Carrega um item da lista no formulário para editar.
  function editarReceitaLocal(i) {
    const r = receitas[i]
    if (!r) return
    const freq = r.frequencia || (r.recorrente ? (r.recorrencia_meses != null ? 'por_meses' : 'mensal') : 'nao_repete')
    setRecForm({
      descricao: r.descricao || '',
      valor: r.valor || '',
      categoria: r.categoria || '',
      data: r.data || hojeISO(),
      frequencia: freq,
      recorrenciaMeses: r.recorrencia_meses != null ? String(r.recorrencia_meses) : '',
      termino: r.ocorrencias != null ? 'ocorrencias' : r.data_fim ? 'data' : 'sem_fim',
      ocorrencias: r.ocorrencias != null ? String(r.ocorrencias) : '',
      dataFim: r.data_fim || '',
    })
    setRecEditIdx(i)
  }
  function removerReceitaLocal(i) {
    setReceitas(prev => prev.filter((_, idx) => idx !== i))
    if (recEditIdx === i) limparRecForm()
  }
  async function salvarReceitas() {
    if (emGravacao.current) return
    // Se o usuário preencheu o form mas não clicou em "Adicionar", inclui aqui.
    let lista = receitas
    const temFormPreenchido = recForm.descricao.trim() || (Number(recForm.valor) || 0) > 0
    if (temFormPreenchido) {
      if (!validarRecForm()) return
      const item = itemReceitaDoForm()
      if (recEditIdx != null) {
        lista = [...receitas]
        lista[recEditIdx] = { ...item, id: receitas[recEditIdx]?.id }
      } else {
        lista = [...receitas, item]
      }
    }

    if (lista.length === 0) { avancar(); return }

    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      // Persiste SEM duplicar: itens com id já existem → UPDATE; sem id → INSERT.
      const salvos = []
      for (const r of lista) {
        const payload = {
          descricao: r.descricao,
          valor: r.valor,
          data: r.data,
          recorrente: r.recorrente,
          categoria: r.categoria,
          frequencia: r.frequencia,
          recorrencia_meses: r.recorrencia_meses,
          ocorrencias: r.ocorrencias,
          data_fim: r.data_fim,
        }
        if (r.id) {
          const atualizado = await atualizarReceita(r.id, payload)
          salvos.push({ ...r, id: atualizado?.id ?? r.id })
        } else {
          const criado = await criarReceita(payload)
          salvos.push({ ...r, id: criado?.id })
        }
      }
      // Mantém a lista COM os ids (sem limpar) para que, ao voltar à etapa, os
      // itens reapareçam e não sejam recriados. Avança após sucesso.
      setReceitas(salvos)
      limparRecForm()
      avancar()
    } catch (e) {
      // NÃO avança em silêncio: mostra erro e impede o avanço.
      setErro(e?.message
        ? `Não foi possível salvar sua renda. Tente novamente. (${e.message})`
        : 'Não foi possível salvar sua renda. Tente novamente.')
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA Despesas ───
  // Validação de propriedade do cartão: só aceita um cartao_id que esteja na
  // lista de cartões do próprio usuário (useCartoes já filtra por usuario_id +
  // RLS). Evita vincular a despesa a um cartão de terceiro. A RLS do banco faz
  // a checagem final (ver migration), isto é a 1ª linha de defesa (UI).
  const cartaoIdValido = (id) =>
    id && cartoes.some(c => c.id === id) ? id : ''

  const despFormVazio = () => ({
    descricao: '', valor: '', categoria_id: '', data: hojeISO(),
    frequencia: 'mensal', recorrenciaMeses: '', forma_pagamento: '', cartao_id: '',
  })
  function itemDespesaDoForm() {
    return {
      descricao: despForm.descricao.trim(), valor: Number(despForm.valor) || 0,
      categoria_id: despForm.categoria_id || null, data: despForm.data || hojeISO(),
      frequencia: despForm.frequencia, recorrenciaMeses: despForm.recorrenciaMeses,
      forma_pagamento: despForm.forma_pagamento || '',
      cartao_id: despForm.forma_pagamento === 'cartao_credito'
        ? cartaoIdValido(despForm.cartao_id) : '',
    }
  }
  function validarDespForm() {
    if (!despForm.descricao.trim()) { setErro('Dê um nome à despesa (ex.: Aluguel).'); return false }
    if (!(Number(despForm.valor) > 0)) { setErro('Informe um valor de despesa maior que zero.'); return false }
    return true
  }
  function limparDespForm() {
    setDespForm(despFormVazio())
    setDespEditIdx(null)
  }
  function editarDespesaLocal(i) {
    const d = despesas[i]
    if (!d) return
    setDespForm({
      descricao: d.descricao || '', valor: d.valor ?? '',
      categoria_id: d.categoria_id || '', data: d.data || hojeISO(),
      frequencia: d.frequencia || 'mensal',
      recorrenciaMeses: d.recorrenciaMeses ?? '',
      forma_pagamento: d.forma_pagamento || '', cartao_id: d.cartao_id || '',
    })
    setDespEditIdx(i)
    setErro('')
  }
  // Salva cada despesa assim que o usuário toca em Adicionar / Salvar alteração.
  // O hook useDespesas retorna o registro do Supabase com ID, evitando duplicações.
  async function adicionarDespesaLocal() {
    if (salvando || emGravacao.current) return false
    if (!usuario?.id || carregandoDespesas || erroCarregamentoDespesas || !despHidratado) {
      setErro('Aguarde o carregamento das despesas. Se houver erro, toque em Tentar novamente.')
      return false
    }
    if (!validarDespForm()) return false

    const item = itemDespesaDoForm()
    const registroAnterior = despEditIdx != null ? despesas[despEditIdx] : null
    const cat = categoriasDespesa.find(c => c.id === item.categoria_id)
    const tipo_despesa = classificarDespesa({
      descricao: item.descricao, categoria: cat?.nome || '',
    })
    let freq = item.frequencia
    let recorrencia_meses = null
    if (freq === 'mensal' && Number(item.recorrenciaMeses) > 0) {
      freq = 'por_meses'
      recorrencia_meses = Number(item.recorrenciaMeses)
    }
    const payload = {
      descricao: item.descricao,
      valor: item.valor,
      data: item.data,
      recorrente: freq !== 'nao_repete',
      frequencia: freq,
      recorrencia_meses,
      categoria_id: item.categoria_id,
      tipo_despesa,
      forma_pagamento: item.forma_pagamento || null,
      cartao_id: item.forma_pagamento === 'cartao_credito'
        ? (cartaoIdValido(item.cartao_id) || null) : null,
    }

    emGravacao.current = true
    setSalvando(true)
    setErro('')
    try {
      const salvo = registroAnterior?.id
        ? await atualizarDespesa(registroAnterior.id, payload)
        : await criarDespesa(payload)
      if (!salvo?.id) throw new Error('O banco não confirmou o salvamento da despesa.')

      const itemSalvo = { ...item, id: salvo.id }
      if (despEditIdx != null) {
        setDespesas(prev => prev.map((d, i) => i === despEditIdx ? itemSalvo : d))
      } else {
        setDespesas(prev => [...prev, itemSalvo])
      }
      limparDespForm()
      return true
    } catch (e) {
      // Preserva o formulário para o usuário tentar novamente.
      setErro(`Não foi possível salvar a despesa. ${e?.message || 'Tente novamente.'}`)
      return false
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }
  async function removerDespesaLocal(i) {
    const d = despesas[i]
    if (!d) return
    if (d.id) {
      if (!window.confirm(`Excluir definitivamente a despesa "${d.descricao}"?`)) return
      try {
        setSalvando(true); setErro('')
        await removerDespesa(d.id)
      } catch (e) {
        setErro(`Não foi possível excluir a despesa. ${e?.message || ''}`)
        setSalvando(false)
        return
      } finally { setSalvando(false) }
    }
    setDespesas(prev => prev.filter(x => x !== d))
    limparDespForm()
  }
  async function salvarDespesas() {
    if (emGravacao.current) return
    // Não avançar com lista vazia enquanto registros já existentes não foram carregados.
    if (carregandoDespesas || erroCarregamentoDespesas || !despHidratado) {
      setErro('Aguarde carregar as despesas existentes ou use Tentar novamente antes de salvar.')
      return
    }
    let lista = despesas
    const temFormPreenchido = despForm.descricao.trim() || (Number(despForm.valor) || 0) > 0
    if (temFormPreenchido) {
      if (!validarDespForm()) return
      const item = itemDespesaDoForm()
      lista = despEditIdx == null ? [...despesas, item] :
        despesas.map((d, i) => i === despEditIdx ? { ...d, ...item } : d)
    }
    if (lista.length === 0) { avancar(); return }
    emGravacao.current = true
    setSalvando(true); setErro('')
    const salvos = []
    try {
      for (const d of lista) {
        const cat = categoriasDespesa.find(c => c.id === d.categoria_id)
        const tipo_despesa = classificarDespesa({
          descricao: d.descricao, categoria: cat?.nome || '',
        })
        let freq = d.frequencia
        let recorrencia_meses = null
        if (d.frequencia === 'mensal' && Number(d.recorrenciaMeses) > 0) {
          freq = 'por_meses'
          recorrencia_meses = Number(d.recorrenciaMeses)
        }
        const payload = {
          descricao: d.descricao, valor: d.valor, data: d.data,
          recorrente: freq !== 'nao_repete', frequencia: freq,
          recorrencia_meses, categoria_id: d.categoria_id, tipo_despesa,
          forma_pagamento: d.forma_pagamento || null,
          cartao_id: d.forma_pagamento === 'cartao_credito' ?
            (cartaoIdValido(d.cartao_id) || null) : null,
        }
        const salvo = d.id
          ? await atualizarDespesa(d.id, payload)
          : await criarDespesa(payload)
        // Salvar ids já criados mesmo se uma operação posterior falhar.
        salvos.push({ ...d, id: salvo?.id || d.id })
      }
      setDespesas(salvos)
      limparDespForm()
      avancar()
    } catch (e) {
      setDespesas([...salvos, ...lista.slice(salvos.length)])
      setErro(e?.message
        ? `Não foi possível salvar suas despesas. Tente novamente. (${e.message})`
        : 'Não foi possível salvar suas despesas. Tente novamente.')
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA Cartões ───
  const limparCartaoForm = () => {
    setCartaoForm({ nome: '', banco: '', limite_total: '', dia_fechamento: '', dia_vencimento: '' })
    setCartaoEditId(null)
  }

  function editarCartao(c) {
    setCartaoEditId(c.id)
    setCartaoForm({
      nome: c.nome || '', banco: c.banco || '',
      limite_total: c.limite_total ?? '',
      dia_fechamento: c.dia_fechamento ?? '',
      dia_vencimento: c.dia_vencimento ?? '',
    })
    setErro('')
  }

  async function excluirCartao(c) {
    if (salvando || emGravacao.current) return
    if (!window.confirm(`Excluir o cartão "${c.nome}"? Compras e faturas vinculadas podem impedir a exclusão.`)) return
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      await removerCartao(c.id)
      if (cartaoEditId === c.id) limparCartaoForm()
    } catch (e) {
      setErro(`Não foi possível excluir o cartão. ${e?.message || ''}`)
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  async function salvarCartao() {
    if (emGravacao.current) return
    const nome = cartaoForm.nome.trim()
    const temAlgo = nome || Number(cartaoForm.limite_total) > 0 ||
      cartaoForm.dia_fechamento || cartaoForm.dia_vencimento
    if (!temAlgo && !cartaoEditId) { avancar(); return }
    if (!nome) { setErro('Dê um nome ao cartão (ex.: Nubank).'); return }
    const diaFech = parseInt(cartaoForm.dia_fechamento, 10)
    const diaVenc = parseInt(cartaoForm.dia_vencimento, 10)
    if (!(diaFech >= 1 && diaFech <= 31)) { setErro('Informe um dia de fechamento entre 1 e 31.'); return }
    if (!(diaVenc >= 1 && diaVenc <= 31)) { setErro('Informe um dia de vencimento entre 1 e 31.'); return }
    const payload = {
      nome, banco: cartaoForm.banco.trim() || null,
      limite_total: Number(cartaoForm.limite_total) || 0,
      dia_fechamento: diaFech, dia_vencimento: diaVenc,
    }
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      if (cartaoEditId) {
        await atualizarCartao(cartaoEditId, payload)
      } else {
        await criarCartao(payload)
      }
      limparCartaoForm()
      avancar()
    } catch (e) {
      setErro(`Não foi possível salvar o cartão. ${e?.message || 'Tente novamente.'}`)
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA Benefícios (VR/VA) ───
  const limparBeneficioForm = () => {
    setBeneficioForm({ nome: '', tipo: 'VR', saldo_inicial: '',
      recarga_valor: '', recarga_dia: '', recarga_recorrente: false })
    setBeneficioEditId(null)
  }

  function editarBeneficio(b) {
    setBeneficioEditId(b.id)
    setBeneficioForm({
      nome: b.nome || '', tipo: b.tipo || 'VR',
      // Saldo real é calculado a partir do extrato: nunca regravar saldo inicial.
      saldo_inicial: '',
      recarga_valor: b.recarga_valor ?? '',
      recarga_dia: b.recarga_dia ?? '',
      recarga_recorrente: !!b.recarga_recorrente,
    })
    setErro('')
  }

  async function excluirBeneficio(b) {
    if (salvando || emGravacao.current) return
    if (!window.confirm(`Excluir definitivamente "${b.nome}" e todo seu extrato de movimentações?`)) return
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      await removerBeneficio(b.id)
      if (beneficioEditId === b.id) limparBeneficioForm()
    } catch (e) {
      setErro(`Não foi possível excluir o benefício. ${e?.message || ''}`)
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  async function salvarBeneficio() {
    if (emGravacao.current) return
    const nome = beneficioForm.nome.trim()
    const temAlgo = nome || Number(beneficioForm.saldo_inicial) > 0 ||
      Number(beneficioForm.recarga_valor) > 0
    if (!temAlgo && !beneficioEditId) { avancar(); return }
    if (!nome) { setErro('Dê um nome ao benefício (ex.: Alelo, VR Benefícios).'); return }
    const dia = beneficioForm.recarga_dia === '' ? null : Number(beneficioForm.recarga_dia)
    if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
      setErro('Informe um dia de recarga entre 1 e 31.'); return
    }
    const payload = {
      nome, tipo: beneficioForm.tipo,
      recarga_valor: Number(beneficioForm.recarga_valor) || 0,
      recarga_dia: dia,
      recarga_recorrente: !!beneficioForm.recarga_recorrente,
    }
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      if (beneficioEditId) {
        // Não altera saldo_inicial: o saldo real pertence às movimentações.
        await atualizarBeneficio(beneficioEditId, payload)
      } else {
        await criarBeneficio({ ...payload, saldo_inicial: Number(beneficioForm.saldo_inicial) || 0 })
      }
      limparBeneficioForm()
    } catch (e) {
      setErro(`Não foi possível salvar o benefício. ${e?.message || 'Tente novamente.'}`)
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

    // Conjunto de receitas sem dupla contagem: a lista local (que, após a
    // hidratação, já contém as persistidas com id) + as existentes cujo id NÃO
    // está na lista local (caso ainda não tenham sido hidratadas).
    const idsLocais = new Set(receitas.filter(r => r.id).map(r => r.id))
    const existentesNaoLocais = (receitasExistentes || []).filter(r => !idsLocais.has(r.id))
    const receitasParaResumo = [...receitas, ...existentesNaoLocais]
    const rendaMensal = receitasParaResumo
      .filter(r => r.recorrente)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)

    const despesasNovas = despesas
      .filter(d => !d.id && d.frequencia !== 'nao_repete')
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

  // Antes de qualquer etapa de configuração, exibe a apresentação (3 telas) no
  // primeiro acesso. Ao concluir/pular, cai no fluxo normal (INTRO em diante).
  if (mostrarApresentacao) {
    return <Apresentacao aoConcluir={concluirApresentacao} />
  }

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
                    <li key={r.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">
                        {r.descricao}
                        <span className="text-xs text-blue-500 ml-1">• {labelFrequenciaReceita(r.frequencia)}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(r.valor)}</span>
                        <button onClick={() => editarReceitaLocal(i)} className="text-gray-400 hover:text-blue-500" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => removerReceitaLocal(i)} className="text-gray-400 hover:text-red-500" title="Remover">
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
                {/* Recorrência */}
                <div>
                  <label className="label">Com que frequência você recebe?</label>
                  <select className="input" value={recForm.frequencia}
                    onChange={(e) => setRecForm(p => ({ ...p, frequencia: e.target.value }))}>
                    {FREQUENCIAS_RECEITA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Intervalo em meses — só p/ "A cada X meses" e "Personalizado" */}
                {(recForm.frequencia === 'por_meses' || recForm.frequencia === 'personalizado') && (
                  <div>
                    <label className="label">A cada quantos meses?</label>
                    <input type="number" min="1" max="60" inputMode="numeric" className="input"
                      placeholder="Ex.: 3" value={recForm.recorrenciaMeses}
                      onChange={(e) => setRecForm(p => ({ ...p, recorrenciaMeses: e.target.value }))} />
                  </div>
                )}

                {/* Término — só p/ receitas recorrentes */}
                {recForm.frequencia !== 'nao_repete' && (
                  <div>
                    <label className="label">Até quando?</label>
                    <select className="input" value={recForm.termino}
                      onChange={(e) => setRecForm(p => ({ ...p, termino: e.target.value }))}>
                      <option value="sem_fim">Sem data de término</option>
                      <option value="ocorrencias">Durante X ocorrências</option>
                      <option value="data">Até uma data específica</option>
                    </select>
                    {recForm.termino === 'ocorrencias' && (
                      <input type="number" min="1" max="600" inputMode="numeric" className="input mt-2"
                        placeholder="Nº de recebimentos (ex.: 12)" value={recForm.ocorrencias}
                        onChange={(e) => setRecForm(p => ({ ...p, ocorrencias: e.target.value }))} />
                    )}
                    {recForm.termino === 'data' && (
                      <input type="date" className="input mt-2" value={recForm.dataFim}
                        onChange={(e) => setRecForm(p => ({ ...p, dataFim: e.target.value }))} />
                    )}
                  </div>
                )}
              </div>
              <button onClick={adicionarReceitaLocal}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                <Plus size={15} /> {recEditIdx != null ? 'Salvar alteração' : 'Adicionar outra renda'}
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

              {carregandoDespesas && !despHidratado && (
                <p className="text-xs text-gray-400 mb-3" role="status">Carregando despesas salvas...</p>
              )}
              {erroCarregamentoDespesas && (
                <div className="mb-3 text-xs text-red-500" role="alert">
                  Não foi possível carregar as despesas salvas: {erroCarregamentoDespesas}.
                  <button type="button" className="underline ml-2" onClick={recarregarDespesas}>
                    Tentar novamente
                  </button>
                </div>
              )}
              {despesas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {despesas.map((d, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">
                        {d.descricao}
                        {d.forma_pagamento && (
                          <span className="block text-[11px] text-gray-400">{labelFormaOnboarding(d.forma_pagamento)}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-red-500">{formatCurrency(d.valor)}</span>
                        <button type="button" onClick={() => editarDespesaLocal(i)}
                          disabled={salvando} className="text-gray-400 hover:text-blue-500" title="Editar despesa" aria-label={`Editar ${d.descricao}`}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => removerDespesaLocal(i)}
                          disabled={salvando} className="text-gray-400 hover:text-red-500" title="Excluir despesa" aria-label={`Excluir ${d.descricao}`}>
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
                <SeletorCategoriaModerno
                  categorias={categoriasDespesa}
                  value={despForm.categoria_id}
                  onChange={(categoria_id) => setDespForm(p => ({ ...p, categoria_id }))}
                />
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

                {/* Forma de pagamento (opcional). Apenas metadado — não cria
                    fatura, compra nem movimentação de benefício. */}
                <select className="input" value={despForm.forma_pagamento}
                  onChange={(e) => setDespForm(p => ({
                    ...p,
                    forma_pagamento: e.target.value,
                    // Ao sair de "cartão de crédito", limpa o cartão escolhido.
                    cartao_id: e.target.value === 'cartao_credito' ? p.cartao_id : '',
                  }))}>
                  <option value="">Forma de pagamento (opcional)</option>
                  {FORMAS_PAGAMENTO_ONBOARDING.map(f => (
                    <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
                  ))}
                </select>

                {/* Cartão de crédito: escolher um cartão já cadastrado, se houver. */}
                {despForm.forma_pagamento === 'cartao_credito' && (
                  cartoes.length === 0 ? (
                    <p className="text-[11px] text-gray-400 -mt-1">
                      Você ainda não tem cartões cadastrados. Poderá vincular um depois, em Cartões.
                    </p>
                  ) : (
                    <select className="input" value={despForm.cartao_id}
                      onChange={(e) => setDespForm(p => ({ ...p, cartao_id: e.target.value }))}>
                      <option value="">Não vincular a um cartão específico</option>
                      {cartoes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>
                      ))}
                    </select>
                  )
                )}
              </div>
              <button type="button" onClick={adicionarDespesaLocal}
                disabled={salvando || carregandoDespesas || !despHidratado || !!erroCarregamentoDespesas}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm disabled:opacity-50">
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {salvando ? 'Salvando despesa...' : despEditIdx != null ? 'Salvar alteração' : 'Adicionar outra despesa'}
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

          {/* ─── ETAPA — Cartões de crédito (opcional) ─── */}
          {etapa === CARTOES && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={CreditCard} cor="text-blue-600" bg="bg-blue-50"
                titulo="Você usa cartão de crédito?"
                subtitulo="Cadastre seus cartões para acompanhar faturas e lançar compras. É opcional — você poderá adicionar depois em Cartões."
              />

              {/* Cartões já cadastrados (nesta sessão ou antes). */}
              {cartoes.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {cartoes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0 flex items-center gap-2">
                        <CreditCard size={15} className="text-blue-500 flex-shrink-0" />
                        {c.nome}{c.banco ? ` • ${c.banco}` : ''}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-700">{formatCurrency(c.limite_total)}</span>
                        <button type="button" disabled={salvando} onClick={() => editarCartao(c)}
                          title="Editar cartão" aria-label={`Editar ${c.nome}`} className="text-gray-400 hover:text-blue-500">
                          <Pencil size={15} />
                        </button>
                        <button type="button" disabled={salvando} onClick={() => excluirCartao(c)}
                          title="Excluir cartão" aria-label={`Excluir ${c.nome}`} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Após cadastrar o cartão, o usuário pode informar o TOTAL da
                  fatura OU lançar compras individuais — ambos já existem na tela
                  de Cartões (fonte única, sem dupla contagem). Evitamos duplicar
                  esses formulários aqui; o atalho leva ao fluxo pronto. */}
              {cartoes.length > 0 && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3">
                  <CreditCard size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    Cartão cadastrado! Depois, em <strong>Cartões</strong>, você pode informar o
                    <strong> total da fatura</strong> do mês ou lançar <strong>compras individuais</strong>
                    {' '}(à vista ou parceladas). As duas formas entram no orçamento sem contar em dobro.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <input className="input" placeholder="Nome do cartão (ex.: Nubank, Bradesco Visa)"
                  value={cartaoForm.nome}
                  onChange={(e) => setCartaoForm(p => ({ ...p, nome: e.target.value }))} />
                <input className="input" placeholder="Banco / instituição (opcional)"
                  value={cartaoForm.banco}
                  onChange={(e) => setCartaoForm(p => ({ ...p, banco: e.target.value }))} />
                <div>
                  <label className="label">Limite total (R$)</label>
                  <InputMoeda valor={cartaoForm.limite_total}
                    onChangeValor={(n) => setCartaoForm(p => ({ ...p, limite_total: n }))}
                    className="input" prefixo={null} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Dia de fechamento</label>
                    <input className="input" type="number" min="1" max="31" inputMode="numeric"
                      placeholder="Ex.: 20" value={cartaoForm.dia_fechamento}
                      onChange={(e) => setCartaoForm(p => ({ ...p, dia_fechamento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Dia de vencimento</label>
                    <input className="input" type="number" min="1" max="31" inputMode="numeric"
                      placeholder="Ex.: 28" value={cartaoForm.dia_vencimento}
                      onChange={(e) => setCartaoForm(p => ({ ...p, dia_vencimento: e.target.value }))} />
                  </div>
                </div>
              </div>
              {cartaoEditId && (
                <button type="button" onClick={limparCartaoForm} disabled={salvando}
                  className="text-xs text-gray-500 underline mt-2">Cancelar edição do cartão</button>
              )}
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarCartao} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Salvar e continuar <ArrowRight size={16} /></>}
                </button>
              </div>

              <div className="mt-3 text-center">
                <button type="button" onClick={pular} disabled={salvando}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50">
                  Pular por enquanto
                </button>
                <p className="text-xs text-gray-400 mt-1">Você poderá cadastrar seus cartões depois.</p>
              </div>
            </div>
          )}

          {/* ─── ETAPA — Benefícios VR/VA (opcional) ─── */}
          {etapa === BENEFICIOS && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={UtensilsCrossed} cor="text-emerald-600" bg="bg-emerald-50"
                titulo="Você recebe Vale-Refeição ou Vale-Alimentação?"
                subtitulo="Cadastre VR e VA para controlar o saldo à parte, sem misturar com o dinheiro da conta. São independentes — cadastre um, os dois ou nenhum. É opcional."
              />

              {/* Benefícios já cadastrados. */}
              {beneficios.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {beneficios.map((b) => (
                    <li key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0 flex items-center gap-2">
                        {b.tipo === 'VA'
                          ? <ShoppingBag size={15} className="text-emerald-500 flex-shrink-0" />
                          : <UtensilsCrossed size={15} className="text-emerald-500 flex-shrink-0" />}
                        {b.nome} <span className="text-xs text-emerald-600">• {b.tipo}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-700">{formatCurrency(saldoDoBeneficio(b.id))}</span>
                        <button type="button" disabled={salvando} onClick={() => editarBeneficio(b)}
                          title="Editar benefício" aria-label={`Editar ${b.nome}`} className="text-gray-400 hover:text-blue-500">
                          <Pencil size={15} />
                        </button>
                        <button type="button" disabled={salvando} onClick={() => excluirBeneficio(b)}
                          title="Excluir benefício" aria-label={`Excluir ${b.nome}`} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: 'VR', t: 'Vale-Refeição' }, { v: 'VA', t: 'Vale-Alimentação' }].map(op => (
                    <button key={op.v} type="button"
                      onClick={() => setBeneficioForm(p => ({ ...p, tipo: op.v }))}
                      className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        beneficioForm.tipo === op.v ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'
                      }`}>
                      {op.t}
                    </button>
                  ))}
                </div>
                <input className="input" placeholder="Nome (ex.: Alelo, VR Benefícios, Sodexo)"
                  value={beneficioForm.nome}
                  onChange={(e) => setBeneficioForm(p => ({ ...p, nome: e.target.value }))} />
                {beneficioEditId ? (
                  <p className="text-xs text-gray-400">O saldo é calculado pelo extrato. Para corrigir o saldo, registre um ajuste na aba Benefícios.</p>
                ) : (
                  <div>
                    <label className="label">Saldo atual (R$)</label>
                    <InputMoeda valor={beneficioForm.saldo_inicial}
                      onChangeValor={(n) => setBeneficioForm(p => ({ ...p, saldo_inicial: n }))}
                      className="input" prefixo={null} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Recarga mensal (R$)</label>
                    <InputMoeda valor={beneficioForm.recarga_valor}
                      onChangeValor={(n) => setBeneficioForm(p => ({ ...p, recarga_valor: n }))}
                      className="input" prefixo={null} />
                  </div>
                  <div>
                    <label className="label">Dia da recarga</label>
                    <input className="input" type="number" min="1" max="31" inputMode="numeric"
                      placeholder="Ex.: 5" value={beneficioForm.recarga_dia}
                      onChange={(e) => setBeneficioForm(p => ({ ...p, recarga_dia: e.target.value }))} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={beneficioForm.recarga_recorrente}
                    onChange={(e) => setBeneficioForm(p => ({ ...p, recarga_recorrente: e.target.checked }))}
                    className="w-4 h-4 accent-current text-emerald-600" />
                  <span className="text-sm text-gray-700">Recarga automática todo mês</span>
                </label>
              </div>

              <button onClick={salvarBeneficio} disabled={salvando}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <><Plus size={15} /> {beneficioEditId ? 'Salvar alteração' : 'Adicionar benefício'}</>}
              </button>
              {beneficioEditId && (
                <button type="button" onClick={limparBeneficioForm} disabled={salvando}
                  className="text-xs text-gray-500 underline mt-2">Cancelar edição do benefício</button>
              )}
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={avancar} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Continuar <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-3 text-center">
                <button type="button" onClick={pular} disabled={salvando}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50">
                  Pular por enquanto
                </button>
                <p className="text-xs text-gray-400 mt-1">Você poderá cadastrar VR/VA depois.</p>
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