import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, ShieldCheck,
  CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, UtensilsCrossed,
  CreditCard, ShoppingBag, Pencil, Target, PiggyBank,
  UserRound, Upload, FileSpreadsheet, Palette, SlidersHorizontal, Star,
} from 'lucide-react'
import NotificacoesPush from '../components/NotificacoesPush'
import { useAuth } from '../contexts/AuthContext'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { useMetas } from '../hooks/useMetas'
import { useAtalhosHome } from '../hooks/useAtalhosHome'
import ModalPersonalizarAtalhos from '../components/ModalPersonalizarAtalhos'
import { ICONES_ATALHOS } from '../components/iconesAtalhos'
import { atalhosVisiveis } from '../lib/atalhosHome'
import { CORES_CARTAO } from '../lib/coresCartao'
import {
  TELAS_ONBOARDING, ETAPAS_ONBOARDING, TOTAL_ETAPAS, etapaDaTela, CHAVE_PARA_TELA, telaParaRetomar,
  OBJETIVOS_FINANCEIROS, normalizarObjetivos, alternarObjetivo, validarPerfil,
  acaoPatrimonioInicial, ehPatrimonioInicial, totalInvestido, validarMeta, itensResumoFinal,
} from '../lib/onboardingFluxo'
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

// Etapas do fluxo: 8 etapas definidas em src/lib/onboardingFluxo.js.
// Opções e rótulo da recorrência de RECEITAS (reutilizadas no form e na lista).
const FREQUENCIAS_RECEITA = [
  { value: 'nao_repete',     label: 'Uma única vez' },
  { value: 'semanal',        label: 'Semanalmente' },
  { value: 'a_cada_10_dias', label: 'A cada 10 dias' },
  { value: 'quinzenal',      label: 'A cada 15 dias' },
  { value: 'a_cada_20_dias', label: 'A cada 20 dias' },
  { value: 'mensal',         label: 'Mensalmente' },
  { value: 'por_meses',      label: 'A cada X meses' },
  { value: 'personalizado',  label: 'Personalizado' },
]
const labelFrequenciaReceita = (freq) => {
  const f = freq || 'mensal'
  if (f === 'nao_repete') return 'uma vez'
  return (FREQUENCIAS_RECEITA.find(o => o.value === f)?.label || f).toLowerCase()
}

// Telas do fluxo (ordem e agrupamento em 8 etapas: src/lib/onboardingFluxo.js).
const PERFIL = 'perfil'
const SALDO = 'saldo'
const RENDA = 'renda'
const BENEFICIOS = 'beneficios'
const DESPESAS = 'despesas'
const CARTOES = 'cartoes'
const IMPORTACAO = 'importacao'
const METAS = 'metas'
const RESERVA = 'reserva'
const PERSONALIZACAO = 'personalizacao'
const NOTIFICACOES = 'notificacoes'
const FINAL = 'final'
const RETOMAR = 'retomar' // tela de escolha "continuar ou ir para o app"

const CHAVE_PROGRESSO = (id) => `almeida_onboarding_progresso_${id}`
const CHAVE_OBJETIVOS = (id) => `almeida_onboarding_objetivos_${id}`

function lerLocal(chave) {
  try { return localStorage.getItem(chave) } catch { return null }
}
function gravarLocal(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
  } catch { /* ignora */ }
}

// Barra de progresso discreta: 8 etapas. Telas que pertencem à mesma etapa
// (ex.: Receitas + VR/VA) mostram o mesmo número.
function Progresso({ etapa }) {
  const atual = etapaDaTela(etapa)
  if (!atual) return null
  const titulo = ETAPAS_ONBOARDING.find(e => e.numero === atual)?.titulo
  return <div className="mb-6" data-testid="onboarding-progresso" data-etapa={atual}>
    <div className="flex items-center justify-between text-xs mb-2">
      <span className="font-semibold text-marca">{titulo}</span>
      <span className="text-gray-500">Etapa {atual} de {TOTAL_ETAPAS}</span>
    </div>
    <div className="flex gap-1.5" aria-hidden="true">{ETAPAS_ONBOARDING.map(e =>
      <div key={e.numero} className={`h-1.5 flex-1 rounded-full ${e.numero <= atual ? 'bg-marca' : 'bg-gray-200'}`} />
    )}</div>
  </div>
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
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-200 last:border-0">
      <span className="text-sm text-gray-500 max-w-[45%]">{label}</span>
      <span className={`text-sm font-semibold text-right min-w-0 ${cor}`}>{valor}</span>
    </div>
  )
}

export default function Onboarding({ aoConcluir, etapaInicial = '' }) {
  const { usuario, perfil, atualizarPreferenciasLimite, corTema, atualizarCorTema, atualizarPerfilOpcional } = useAuth()
  // Investimentos e metas: mesmos hooks/tabelas dos módulos do app.
  const {
    investimentos, movimentacoes, carregando: carregandoInvestimentos,
    criar: criarInvestimento, atualizar: atualizarInvestimento, remover: removerInvestimento,
  } = useInvestimentos()
  const { metas, carregando: carregandoMetas, criar: criarMeta, atualizar: atualizarMeta, remover: removerMeta } = useMetas()
  const { config: configAtalhos, salvar: salvarAtalhos } = useAtalhosHome()
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

  // Tela inicial: reabertura direcionada (card da Home) → tela do item;
  // progresso salvo de um onboarding interrompido → oferece retomar;
  // senão começa pelo Perfil.
  const progressoSalvo = () => telaParaRetomar(
    perfil?.onboarding_etapa || (usuario?.id ? lerLocal(CHAVE_PROGRESSO(usuario.id)) : null))
  const [etapa, setEtapa] = useState(() => {
    const alvo = CHAVE_PARA_TELA[etapaInicial]
    if (alvo) return alvo
    return progressoSalvo() ? RETOMAR : PERFIL
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Salva a tela atual (para continuar depois). localStorage sempre;
  // perfis.onboarding_etapa quando a coluna existir (migration pendente).
  useEffect(() => {
    if (!usuario?.id || etapa === RETOMAR || etapa === FINAL) return
    gravarLocal(CHAVE_PROGRESSO(usuario.id), etapa)
    atualizarPerfilOpcional?.({ onboarding_etapa: etapa })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, usuario?.id])

  // ETAPA 1 — Perfil: nome de preferência (perfis.nome, já existente) e
  // objetivos (perfis.objetivos_financeiros quando existir; cópia local).
  const [nomePreferido, setNomePreferido] = useState(() => perfil?.nome || '')
  const [objetivos, setObjetivos] = useState(() => {
    if (Array.isArray(perfil?.objetivos_financeiros)) return normalizarObjetivos(perfil.objetivos_financeiros)
    try { return normalizarObjetivos(JSON.parse(lerLocal(CHAVE_OBJETIVOS(usuario?.id)) || '[]')) } catch { return [] }
  })

  // ETAPA 2 — patrimônio investido (módulo Investimentos, separado do saldo).
  const registroPatrimonio = investimentos.find(ehPatrimonioInicial) || null
  const investimentosProprios = investimentos.filter(i => !ehPatrimonioInicial(i))
  const [patrimonio, setPatrimonio] = useState('')
  const [patrimonioHidratado, setPatrimonioHidratado] = useState(false)
  useEffect(() => {
    if (patrimonioHidratado || carregandoInvestimentos) return
    if (registroPatrimonio) setPatrimonio(Number(registroPatrimonio.valor_atual) || 0)
    setPatrimonioHidratado(true)
  }, [carregandoInvestimentos, registroPatrimonio, patrimonioHidratado])

  // ETAPA 7 — Metas (gravadas na hora, como as despesas, para não duplicar).
  const metaFormVazio = { nome: '', valor_desejado: '', valor_atual: '', prazo: '' }
  const [metaForm, setMetaForm] = useState(metaFormVazio)
  const [metaEditId, setMetaEditId] = useState(null)

  // ETAPA 5 — cor do cartão (mesma paleta da página Cartões).
  const [personalizandoAtalhos, setPersonalizandoAtalhos] = useState(false)

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
    if (progressoSalvo()) return false        // retomada: já passou pela apresentação
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
    descricao: '', valor: '', categoria_id: '', subcategoria_id: '', data: hojeISO(),
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
        categoria_id: d.categoria_id || '', subcategoria_id: d.subcategoria_id || '', data: d.data,
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
    nome: '', banco: '', limite_total: '', dia_fechamento: '', dia_vencimento: '', cor: CORES_CARTAO[0].valor,
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

  // Navegação em ordem pelas telas (src/lib/onboardingFluxo.js). Como o fluxo
  // pode ter sido iniciado no meio (card da Home), segue sempre a ordem.
  const avancar = () => {
    setErro('')
    setEtapa((e) => {
      const i = TELAS_ONBOARDING.indexOf(e)
      return i < 0 ? PERFIL : TELAS_ONBOARDING[Math.min(i + 1, TELAS_ONBOARDING.length - 1)]
    })
  }
  const voltar = () => {
    setErro('')
    setEtapa((e) => {
      const i = TELAS_ONBOARDING.indexOf(e)
      return i <= 0 ? PERFIL : TELAS_ONBOARDING[i - 1]
    })
  }

  // ─── ETAPA 1 — Perfil ───
  async function salvarPerfil() {
    if (emGravacao.current) return
    const problema = validarPerfil({ nome: nomePreferido })
    if (problema) { setErro(problema); return }
    const nome = nomePreferido.trim()
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      if (nome !== (perfil?.nome || '')) await atualizarPreferenciasLimite({ nome })
      const lista = normalizarObjetivos(objetivos)
      gravarLocal(CHAVE_OBJETIVOS(usuario?.id), JSON.stringify(lista))
      await atualizarPerfilOpcional?.({ objetivos_financeiros: lista })
      avancar()
    } catch (e) {
      setErro(`Não foi possível salvar seu perfil. ${e?.message || 'Tente novamente.'}`)
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // "Ir para o app agora": conclui o primeiro acesso mantendo o que já foi
  // salvo. O que faltar continua no card "Complete sua configuração" da Home.
  async function terminarDepois() {
    if (emGravacao.current) return
    emGravacao.current = true
    setSalvando(true)
    try {
      await aoConcluir?.()
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── ETAPA 7 — Metas ───
  async function salvarMetaForm() {
    if (salvando || emGravacao.current) return false
    const problema = validarMeta(metaForm, hojeISO())
    if (problema) { setErro(problema); return false }
    const payload = {
      nome: metaForm.nome.trim(),
      valor_desejado: Number(metaForm.valor_desejado),
      valor_atual: Number(metaForm.valor_atual) || 0,
      prazo: metaForm.prazo || null,
    }
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      if (metaEditId) await atualizarMeta(metaEditId, payload)
      else await criarMeta({ ...payload, cor: '#801D39' })
      setMetaForm(metaFormVazio)
      setMetaEditId(null)
      return true
    } catch (e) {
      setErro(`Não foi possível salvar a meta. ${e?.message || 'Tente novamente.'}`)
      return false
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }
  function editarMeta(m) {
    setMetaEditId(m.id)
    setMetaForm({
      nome: m.nome || '', valor_desejado: Number(m.valor_desejado) || '',
      valor_atual: Number(m.valor_atual) || '', prazo: m.prazo || '',
    })
    setErro('')
  }
  async function excluirMeta(m) {
    if (salvando || emGravacao.current) return
    if (!window.confirm(`Excluir a meta "${m.nome}"?`)) return
    emGravacao.current = true
    setSalvando(true); setErro('')
    try {
      await removerMeta(m.id)
      if (metaEditId === m.id) { setMetaEditId(null); setMetaForm(metaFormVazio) }
    } catch (e) {
      setErro(`Não foi possível excluir a meta. ${e?.message || ''}`)
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }
  async function continuarMetas() {
    const preenchido = metaForm.nome.trim() || Number(metaForm.valor_desejado) > 0
    if (preenchido && !(await salvarMetaForm())) return
    avancar()
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
    if (valor < 0) { setErro('O saldo não pode ser negativo.'); emGravacao.current = false; return }
    // Patrimônio investido: decidido ANTES de gravar, para não salvar metade.
    const acao = carregandoInvestimentos
      ? { tipo: 'aguardar' }
      : acaoPatrimonioInicial({ investimentos, movimentacoes, valor: patrimonio })
    if (acao.tipo === 'aguardar') { setErro('Aguarde carregar seus investimentos e tente de novo.'); emGravacao.current = false; return }
    if (acao.tipo === 'invalido') { setErro(acao.motivo); emGravacao.current = false; return }
    setSalvando(true); setErro('')
    try {
      // Saldo em conta (perfis.saldo_base). Só regrava quando mudou, para não
      // mover a data-base do saldo sem necessidade ao voltar à etapa.
      const mudouSaldo = perfil?.saldo_base == null || Number(perfil.saldo_base) !== valor
      if (mudouSaldo) await atualizarPreferenciasLimite({ saldo_base: valor, saldo_base_data: hojeISO() })
      // Patrimônio: uma posição no módulo Investimentos, NUNCA somada ao saldo.
      if (acao.tipo === 'criar') await criarInvestimento({ ...acao.dados, data_aplicacao: hojeISO() })
      else if (acao.tipo === 'atualizar') await atualizarInvestimento(acao.registro.id, acao.dados)
      else if (acao.tipo === 'remover') await removerInvestimento(acao.registro.id)
      setEtapa(RENDA)
    } catch (e) {
      setErro(`Não foi possível salvar. ${e?.message || 'Tente novamente.'}`)
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
    descricao: '', valor: '', categoria_id: '', subcategoria_id: '', data: hojeISO(),
    frequencia: 'mensal', recorrenciaMeses: '', forma_pagamento: '', cartao_id: '',
  })
  function itemDespesaDoForm() {
    return {
      descricao: despForm.descricao.trim(), valor: Number(despForm.valor) || 0,
      categoria_id: despForm.categoria_id || null, subcategoria_id: despForm.subcategoria_id || null, data: despForm.data || hojeISO(),
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
      categoria_id: d.categoria_id || '', subcategoria_id: d.subcategoria_id || '', data: d.data || hojeISO(),
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
      subcategoria_id: item.subcategoria_id || null,
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
          recorrencia_meses, categoria_id: d.categoria_id, subcategoria_id: d.subcategoria_id || null, tipo_despesa,
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
    setCartaoForm({ nome: '', banco: '', limite_total: '', dia_fechamento: '', dia_vencimento: '', cor: CORES_CARTAO[0].valor })
    setCartaoEditId(null)
  }

  function editarCartao(c) {
    setCartaoEditId(c.id)
    setCartaoForm({
      nome: c.nome || '', banco: c.banco || '',
      limite_total: c.limite_total ?? '',
      dia_fechamento: c.dia_fechamento ?? '',
      dia_vencimento: c.dia_vencimento ?? '',
      cor: c.cor || CORES_CARTAO[0].valor,
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

  // continuar=false: grava e permanece na etapa para cadastrar outro cartão.
  async function salvarCartao({ continuar = true } = {}) {
    if (emGravacao.current) return
    const nome = cartaoForm.nome.trim()
    const temAlgo = nome || Number(cartaoForm.limite_total) > 0 ||
      cartaoForm.dia_fechamento || cartaoForm.dia_vencimento
    if (!temAlgo && !cartaoEditId) { if (continuar) avancar(); return }
    if (!nome) { setErro('Dê um nome ao cartão (ex.: Nubank).'); return }
    const diaFech = parseInt(cartaoForm.dia_fechamento, 10)
    const diaVenc = parseInt(cartaoForm.dia_vencimento, 10)
    if (!(diaFech >= 1 && diaFech <= 31)) { setErro('Informe um dia de fechamento entre 1 e 31.'); return }
    if (!(diaVenc >= 1 && diaVenc <= 31)) { setErro('Informe um dia de vencimento entre 1 e 31.'); return }
    const payload = {
      nome, banco: cartaoForm.banco.trim() || null,
      limite_total: Number(cartaoForm.limite_total) || 0,
      dia_fechamento: diaFech, dia_vencimento: diaVenc,
      cor: cartaoForm.cor || CORES_CARTAO[0].valor,
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
      if (continuar) avancar()
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
      // Fluxo concluído: limpa o ponto de retomada.
      if (usuario?.id) gravarLocal(CHAVE_PROGRESSO(usuario.id), null)
      atualizarPerfilOpcional?.({ onboarding_etapa: null })
    } finally {
      setSalvando(false)
      emGravacao.current = false
    }
  }

  // ─── Resumo final ───
  // Só o que foi REALMENTE cadastrado, lido das mesmas tabelas do app (sem
  // estimativas próprias: os cálculos de saldo e limite ficam com a Home).
  const resumoFinal = useMemo(() => {
    const idsLocais = new Set(receitas.filter(r => r.id).map(r => r.id))
    const qtdReceitas = idsLocais.size + (receitasExistentes || []).filter(r => !idsLocais.has(r.id)).length
    const idsDesp = new Set([...despesas.filter(d => d.id).map(d => d.id), ...(despesasExistentes || []).map(d => d.id)])
    return itensResumoFinal({
      nome: (perfil?.nome || '').trim(),
      objetivos: normalizarObjetivos(objetivos),
      saldoConfigurado: perfil?.saldo_base != null,
      saldo: perfil?.saldo_base,
      patrimonio: totalInvestido(investimentos),
      qtdReceitas,
      qtdBeneficios: beneficios.length,
      qtdDespesas: idsDesp.size,
      qtdCartoes: cartoes.length,
      qtdMetas: metas.length,
      reservaConfigurada: perfil?.reserva_configurada === true,
      reservaAtual: perfil?.reserva_atual,
      reservaPct: perfil?.reserva_percentual ?? 20,
      tema: corTema,
    })
  }, [perfil, objetivos, investimentos, receitas, receitasExistentes, despesas, despesasExistentes, beneficios, cartoes, metas, corTema])

  // Antes de qualquer etapa de configuração, exibe a apresentação no primeiro
  // acesso. Ao concluir/pular, começa a Etapa 1 (Perfil).
  if (mostrarApresentacao) {
    return <Apresentacao aoConcluir={concluirApresentacao} />
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-start sm:items-center justify-center px-3 py-5 sm:p-8 pb-24 sm:pb-8">
      <div className="w-full max-w-lg min-w-0">
        <div className="card w-full min-w-0 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl p-4 sm:p-7">
          {/* A barra de progresso só aparece nas etapas de configuração. */}
          {/* Barra de progresso: etapas 1 a 8 (oculta na retomada e no final). */}
          {etapa !== RETOMAR && etapa !== FINAL && <Progresso etapa={etapa} />}

          {/* ─── RETOMAR — onboarding interrompido ─── */}
          {etapa === RETOMAR && (
            <div className="py-2" data-testid="onboarding-retomar">
              <div className="flex items-center gap-3 mb-4">
                <img src="/branding/af-icone.png" alt="Almeida Finance" className="w-12 h-auto flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">Bem-vindo de volta</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Sua configuração ficou pela metade.</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                O que você já informou está salvo. Continue de onde parou ou vá para o app e termine depois
                pelo card <strong>Complete sua configuração</strong>.
              </p>
              <button type="button" onClick={() => setEtapa(progressoSalvo() || PERFIL)}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                Continuar de onde parei <ArrowRight size={16} />
              </button>
              <button type="button" onClick={terminarDepois} disabled={salvando}
                className="btn-secondary w-full mt-2 py-3 disabled:opacity-60">
                Ir para o app agora
              </button>
            </div>
          )}

          {/* ─── ETAPA 1 — Perfil e objetivos ─── */}
          {etapa === PERFIL && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={UserRound} cor="text-marca" bg="bg-marca-100"
                titulo="Vamos nos conhecer"
                subtitulo="Assim o Almeida Finance fala com você do seu jeito. Tudo pode ser editado depois."
              />
              <label className="label" htmlFor="onb-nome">Como prefere ser chamado?</label>
              <input id="onb-nome" className="input" value={nomePreferido} maxLength={60}
                autoComplete="given-name" placeholder="Seu nome"
                onChange={(e) => { setNomePreferido(e.target.value); setErro('') }} />

              <p className="label mt-5">O que você quer alcançar? <span className="text-gray-400 font-normal">(escolha quantos quiser)</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Objetivos financeiros">
                {OBJETIVOS_FINANCEIROS.map(o => {
                  const ativo = objetivos.includes(o.id)
                  return (
                    <button key={o.id} type="button" aria-pressed={ativo}
                      onClick={() => setObjetivos(l => alternarObjetivo(l, o.id))}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        ativo ? 'border-marca bg-marca-100 text-marca font-semibold' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}>
                      {ativo ? <CheckCircle2 size={16} className="flex-shrink-0" /> : <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" />}
                      {o.label}
                    </button>
                  )
                })}
              </div>

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={salvarPerfil} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 2 — Saldo em contas + patrimônio investido (separados) ─── */}
          {etapa === SALDO && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={Wallet} cor="text-marca" bg="bg-marca-100"
                titulo="Seu dinheiro hoje"
                subtitulo="Informe separadamente o que está disponível para gastar e o que está investido."
              />
              <label className="label" htmlFor="onb-saldo">Saldo disponível em contas</label>
              <p className="text-xs text-gray-500 -mt-0.5 mb-1.5">Quanto dinheiro você tem disponível atualmente? Some contas e carteiras digitais. Não inclua limite de crédito.</p>
              <InputMoeda id="onb-saldo"
                valor={saldo} onChangeValor={setSaldo}
                className="input text-2xl font-bold text-center py-3" prefixo={null} autoFocus
              />

              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <label className="label flex items-center gap-2" htmlFor="onb-patrimonio">
                  <PiggyBank size={16} className="text-marca" /> Patrimônio investido
                </label>
                {investimentosProprios.length > 0 ? (
                  <p className="text-sm text-gray-700" data-testid="onboarding-patrimonio-existente">
                    Você já tem <strong>{formatCurrency(totalInvestido(investimentos))}</strong> em investimentos
                    cadastrados. Para alterar, use o módulo Investimentos (nada é duplicado aqui).
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 -mt-0.5 mb-1.5">Quanto você possui aplicado em investimentos? Pode deixar em branco.</p>
                    <InputMoeda id="onb-patrimonio" valor={patrimonio} onChangeValor={setPatrimonio}
                      className="input" prefixo={null} />
                  </>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  O patrimônio fica no módulo Investimentos: <strong>não entra no saldo disponível</strong> para gastos
                  e não conta como receita. Depois você pode detalhar por ativo.
                </p>
              </div>

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3" aria-label="Voltar">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarSaldo} disabled={salvando || carregandoInvestimentos}
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
                        <span className="text-xs text-marca ml-1">• {labelFrequenciaReceita(r.frequencia)}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(r.valor)}</span>
                        <button onClick={() => editarReceitaLocal(i)} className="text-gray-400 hover:text-marca" title="Editar">
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
                          disabled={salvando} className="text-gray-400 hover:text-marca" title="Editar despesa" aria-label={`Editar ${d.descricao}`}>
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
                  onChange={(categoria_id) => setDespForm(p => ({ ...p, categoria_id, subcategoria_id: '' }))}
                  subcategoriaValue={despForm.subcategoria_id}
                  onSubcategoriaChange={(subcategoria_id) => setDespForm(p => ({ ...p, subcategoria_id }))}
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
                icone={CreditCard} cor="text-marca" bg="bg-marca-100"
                titulo="Você usa cartão de crédito?"
                subtitulo="Cadastre seus cartões para acompanhar faturas e lançar compras. É opcional — você poderá adicionar depois em Cartões."
              />

              {/* Cartões já cadastrados (nesta sessão ou antes). */}
              {cartoes.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {cartoes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0 flex items-center gap-2">
                        <CreditCard size={15} className="text-marca flex-shrink-0" />
                        {c.nome}{c.banco ? ` • ${c.banco}` : ''}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-700">{formatCurrency(c.limite_total)}</span>
                        <button type="button" disabled={salvando} onClick={() => editarCartao(c)}
                          title="Editar cartão" aria-label={`Editar ${c.nome}`} className="text-gray-400 hover:text-marca">
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
                <div className="flex items-start gap-2.5 bg-marca-100 border border-marca/20 rounded-xl px-3 py-2.5 mb-3">
                  <CreditCard size={16} className="text-marca flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-marca">
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
                {/* Cor do cartão — mesma paleta da página Cartões. */}
                <div>
                  <p className="label">Cor do cartão</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Cor do cartão">
                    {CORES_CARTAO.map(c => (
                      <button key={c.valor} type="button" title={c.nome} aria-label={c.nome}
                        aria-pressed={cartaoForm.cor === c.valor}
                        onClick={() => setCartaoForm(p => ({ ...p, cor: c.valor }))}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${cartaoForm.cor === c.valor ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.fundo }} />
                    ))}
                  </div>
                  <div className="mt-2 rounded-xl p-3 flex items-center gap-2 text-sm font-medium"
                    style={{ background: cartaoForm.cor, color: CORES_CARTAO.find(c => c.valor === cartaoForm.cor)?.texto || '#fff' }}>
                    <CreditCard size={16} /> {cartaoForm.nome || 'Meu cartão'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => salvarCartao({ continuar: false })} disabled={salvando}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm disabled:opacity-50">
                <Plus size={15} /> {cartaoEditId ? 'Salvar alteração' : 'Adicionar e cadastrar outro'}
              </button>
              {cartaoEditId && (
                <button type="button" onClick={limparCartaoForm} disabled={salvando}
                  className="text-xs text-gray-500 underline mt-2">Cancelar edição do cartão</button>
              )}
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={() => salvarCartao()} disabled={salvando}
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
                          title="Editar benefício" aria-label={`Editar ${b.nome}`} className="text-gray-400 hover:text-marca">
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
                        ativo ? 'bg-marca text-white border-marca' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
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
                    modoCustom ? 'bg-marca text-white border-marca' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
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

          {/* ─── NOTIFICAÇÕES ─── */}
          {etapa === NOTIFICACOES && (
            <div className="py-2">
              <NotificacoesPush
                contexto="onboarding"
                onPular={avancar}
                onConcluir={avancar}
              />
            </div>
          )}

          {/* ─── ETAPA 6 — Importação Inteligente (Em breve) ─── */}
          {etapa === IMPORTACAO && (
            <div className="py-2">
              <span className="inline-block mb-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
                data-testid="onboarding-importacao-em-breve">Em breve</span>
              <CabecalhoEtapa
                icone={Upload} cor="text-marca" bg="bg-marca-100"
                titulo="Quer organizar suas finanças ainda mais rápido?"
                subtitulo="Importe seus extratos, faturas ou investimentos e confira os dados identificados."
              />
              <div className="rounded-xl border border-dashed border-gray-300 p-4 flex items-center gap-3 text-sm text-gray-500">
                <FileSpreadsheet size={22} className="text-gray-400 flex-shrink-0" />
                <span>A Importação Inteligente (CSV, OFX, planilhas e PDF) ainda está em desenvolvimento. Você revisará tudo antes de salvar, e nada é duplicado.</span>
              </div>
              <button type="button" disabled aria-disabled="true"
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                <Upload size={16} /> Importar agora
              </button>
              <button type="button" onClick={() => setEtapa(RENDA)}
                className="btn-secondary w-full mt-2">
                Cadastrar manualmente
              </button>
              <div className="flex gap-2 mt-4">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3" aria-label="Voltar">
                  <ArrowLeft size={16} />
                </button>
                <button type="button" onClick={avancar}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  Deixar para depois <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 7 — Metas ─── */}
          {etapa === METAS && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={Target} cor="text-marca" bg="bg-marca-100"
                titulo="Qual conquista você quer alcançar?"
                subtitulo="Crie uma meta financeira. É opcional, e você acompanha a evolução no módulo Metas."
              />
              {carregandoMetas && <p className="text-xs text-gray-400 mb-3" role="status">Carregando metas salvas...</p>}
              {metas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {metas.map(m => (
                    <li key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">
                        {m.nome}
                        {m.prazo && <span className="block text-[11px] text-gray-400">até {new Date(`${m.prazo}T12:00:00`).toLocaleDateString('pt-BR')}</span>}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-700">{formatCurrency(m.valor_desejado)}</span>
                        <button type="button" disabled={salvando} onClick={() => editarMeta(m)}
                          aria-label={`Editar ${m.nome}`} className="text-gray-400 hover:text-marca"><Pencil size={15} /></button>
                        <button type="button" disabled={salvando} onClick={() => excluirMeta(m)}
                          aria-label={`Excluir ${m.nome}`} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2">
                <input className="input" placeholder="Nome da meta (ex.: Viagem, Carro)" maxLength={80}
                  value={metaForm.nome} onChange={(e) => setMetaForm(p => ({ ...p, nome: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Valor desejado</label>
                    <InputMoeda valor={metaForm.valor_desejado} prefixo={null} className="input"
                      onChangeValor={(n) => setMetaForm(p => ({ ...p, valor_desejado: n }))} />
                  </div>
                  <div>
                    <label className="label">Prazo <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <input type="date" className="input" min={hojeISO()} value={metaForm.prazo}
                      onChange={(e) => setMetaForm(p => ({ ...p, prazo: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Quanto você já tem guardado para ela? <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <InputMoeda valor={metaForm.valor_atual} prefixo={null} className="input"
                    onChangeValor={(n) => setMetaForm(p => ({ ...p, valor_atual: n }))} />
                </div>
              </div>
              <button type="button" onClick={salvarMetaForm} disabled={salvando}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm disabled:opacity-50">
                <Plus size={15} /> {metaEditId ? 'Salvar alteração' : 'Adicionar meta'}
              </button>
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3" aria-label="Voltar">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={continuarMetas} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
              <div className="mt-3 text-center">
                <button type="button" onClick={pular} disabled={salvando}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50">
                  Pular por enquanto
                </button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 8 — Tema e atalhos ─── */}
          {etapa === PERSONALIZACAO && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={Palette} cor="text-marca" bg="bg-marca-100"
                titulo="Deixe o app do seu jeito"
                subtitulo="Escolha a aparência e os atalhos que aparecem primeiro na sua Home."
              />
              <p className="label">Aparência</p>
              <div className="grid grid-cols-3 gap-2">
                {CORES_TEMA.map(op => {
                  const ativo = corTema === op.value
                  const icone = op.value === 'escuro' ? '🌙' : op.auto ? '⚙️' : '☀️'
                  return (
                    <button key={op.value} type="button" onClick={() => atualizarCorTema(op.value)} aria-pressed={ativo}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                        ativo ? 'border-marca ring-1 ring-marca bg-marca-100/30' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-xl" aria-hidden="true">{icone}</span>
                      <span className="text-xs font-semibold text-gray-900">{op.label}</span>
                    </button>
                  )
                })}
              </div>

              <p className="label mt-5">Atalhos da Home</p>
              <div className="flex flex-wrap gap-1.5" data-testid="onboarding-atalhos-previa">
                {atalhosVisiveis(configAtalhos).slice(0, 6).map(a => {
                  const Ic = ICONES_ATALHOS[a.id]
                  return (
                    <span key={a.id} data-atalho={a.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700">
                      {a.favorito ? <Star size={12} className="text-amber-500 fill-amber-400" /> : <Ic size={12} className="text-marca" />}
                      {a.label}
                    </span>
                  )
                })}
                <span className="text-xs text-gray-400 self-center">…</span>
              </div>
              <button type="button" onClick={() => setPersonalizandoAtalhos(true)}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1.5 text-sm">
                <SlidersHorizontal size={15} /> Escolher e ordenar atalhos
              </button>

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3" aria-label="Voltar">
                  <ArrowLeft size={16} />
                </button>
                <button type="button" onClick={avancar}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Continuar <ArrowRight size={16} />
                </button>
              </div>
              {personalizandoAtalhos && (
                <ModalPersonalizarAtalhos aberto configInicial={configAtalhos}
                  onFechar={() => setPersonalizandoAtalhos(false)}
                  onSalvar={async nova => { const r = await salvarAtalhos(nova); setPersonalizandoAtalhos(false); return r }} />
              )}
            </div>
          )}

          {/* ─── FINALIZAÇÃO ─── */}
          {etapa === FINAL && (
            <div className="py-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={30} className="text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Tudo pronto!</h1>
                <p className="text-sm text-gray-500 mb-5">
                  Seu Almeida Finance está preparado para ajudar você a organizar seu dinheiro e planejar suas próximas conquistas.
                </p>
              </div>

              {resumoFinal.length > 0 ? (
                <div className="bg-gray-50 rounded-xl px-4 py-2 mb-5" data-testid="onboarding-resumo">
                  {resumoFinal.map(i => <LinhaResumo key={i.id} label={i.label} valor={i.valor} />)}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center mb-5">Nada foi cadastrado ainda. Você pode adicionar tudo pela Home.</p>
              )}

              <div className="flex gap-2">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3" aria-label="Voltar">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={finalizar} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Abrindo...</> : <>Ir para minha Home <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}
        </div>

        {etapa !== RETOMAR && etapa !== FINAL ? (
          <p className="text-center mt-4">
            <button type="button" onClick={terminarDepois} disabled={salvando}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
              data-testid="onboarding-terminar-depois">
              Terminar a configuração depois (o que já foi salvo fica guardado)
            </button>
          </p>
        ) : (
          <p className="text-center text-xs text-gray-400 mt-4">Almeida Finance</p>
        )}
      </div>
    </div>
  )
}
