// ─── Onboarding financeiro: estrutura das 8 etapas e regras puras ───────────
// Sem React nem Supabase (testável em Node). A página src/pages/Onboarding.jsx
// usa estas definições para ordem das telas, barra de progresso, retomada,
// patrimônio inicial (sem duplicar) e resumo final.

// Telas internas, na ordem do fluxo. Algumas etapas têm duas telas
// (ex.: Receitas → benefícios VR/VA), contadas como UMA etapa no progresso.
export const TELAS_ONBOARDING = [
  'perfil',         // 1
  'importacao',     // 2  importação inteligente (opcional, antes do preenchimento manual)
  'saldo',          // 3  saldo em conta + patrimônio investido
  'renda',          // 4
  'beneficios',     // 4  (VR/VA, opcional)
  'despesas',       // 5
  'cartoes',        // 6
  'metas',          // 7
  'reserva',        // 7  (reserva de emergência)
  'personalizacao', // 8  tema + atalhos
  'notificacoes',   // 8  (alertas push, opcional)
  'final',
]

export const ETAPAS_ONBOARDING = [
  { numero: 1, titulo: 'Perfil', telas: ['perfil'] },
  { numero: 2, titulo: 'Importação', telas: ['importacao'] },
  { numero: 3, titulo: 'Saldo e investimentos', telas: ['saldo'] },
  { numero: 4, titulo: 'Receitas', telas: ['renda', 'beneficios'] },
  { numero: 5, titulo: 'Despesas', telas: ['despesas'] },
  { numero: 6, titulo: 'Cartões', telas: ['cartoes'] },
  { numero: 7, titulo: 'Metas', telas: ['metas', 'reserva'] },
  { numero: 8, titulo: 'Personalização', telas: ['personalizacao', 'notificacoes'] },
]

export const TOTAL_ETAPAS = ETAPAS_ONBOARDING.length

export function indiceTela(tela) {
  return TELAS_ONBOARDING.indexOf(tela)
}

// Etapa (1..8) de uma tela; null para a tela final ou desconhecida.
export function etapaDaTela(tela) {
  const e = ETAPAS_ONBOARDING.find(x => x.telas.includes(tela))
  return e ? e.numero : null
}

// Chaves usadas pelo card "Complete sua configuração" da Home e por links
// antigos → tela correspondente no novo fluxo.
export const CHAVE_PARA_TELA = {
  perfil: 'perfil',
  saldo: 'saldo',
  investimentos: 'saldo',
  renda: 'renda',
  despesas: 'despesas',
  cartoes: 'cartoes',
  metas: 'metas',
  reserva: 'reserva',
}

// Progresso salvo (localStorage/perfil) → tela válida para retomar, ou null.
// Nunca retoma na tela final (o fluxo já estaria concluído).
export function telaParaRetomar(salva) {
  if (typeof salva !== 'string') return null
  if (!TELAS_ONBOARDING.includes(salva) || salva === 'final' || salva === 'perfil') return null
  return salva
}

// ── Objetivos financeiros (Etapa 1) ──────────────────────────────────────────
export const OBJETIVOS_FINANCEIROS = [
  { id: 'organizar', label: 'Organizar minhas finanças' },
  { id: 'economizar', label: 'Economizar dinheiro' },
  { id: 'sair_dividas', label: 'Sair das dívidas' },
  { id: 'reserva', label: 'Construir reserva financeira' },
  { id: 'investimentos', label: 'Acompanhar investimentos' },
  { id: 'grandes_compras', label: 'Planejar grandes compras' },
]
const IDS_OBJETIVOS = new Set(OBJETIVOS_FINANCEIROS.map(o => o.id))

export function normalizarObjetivos(lista) {
  if (!Array.isArray(lista)) return []
  return [...new Set(lista.filter(id => typeof id === 'string' && IDS_OBJETIVOS.has(id)))]
}

export function alternarObjetivo(lista, id) {
  const atual = normalizarObjetivos(lista)
  if (!IDS_OBJETIVOS.has(id)) return atual
  return atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]
}

export function validarPerfil({ nome }) {
  const n = String(nome || '').trim()
  if (!n) return 'Informe como prefere ser chamado.'
  if (n.length > 60) return 'Use até 60 caracteres no nome.'
  return null
}

// ── Patrimônio investido inicial (Etapa 2) ───────────────────────────────────
// O valor informado vira UMA posição no módulo Investimentos, identificada por
// este nome. Fica separado do saldo em conta (perfis.saldo_base): não entra no
// saldo disponível, não é receita e não gera movimentação.
export const NOME_PATRIMONIO_INICIAL = 'Patrimônio informado no cadastro inicial'

export function ehPatrimonioInicial(inv) {
  return !!inv && inv.nome === NOME_PATRIMONIO_INICIAL
}

// Decide o que fazer com o patrimônio informado, SEM duplicar:
//  • se o usuário já tem investimentos próprios (fora do registro do
//    onboarding), não cria nada — o patrimônio já está no módulo;
//  • se o registro do onboarding já existe, atualiza o mesmo registro;
//  • se tem movimentações, não altera (o valor passou a ser controlado lá).
export function acaoPatrimonioInicial({ investimentos = [], movimentacoes = [], valor }) {
  const v = Math.round((Number(valor) || 0) * 100) / 100
  if (!Number.isFinite(v) || v < 0) return { tipo: 'invalido', motivo: 'Informe um valor de patrimônio válido.' }
  const registro = investimentos.find(ehPatrimonioInicial) || null
  const proprios = investimentos.filter(i => !ehPatrimonioInicial(i))
  if (proprios.length > 0) return { tipo: 'ja_cadastrado', registro }
  if (registro) {
    const temMov = movimentacoes.some(m => m.investimento_id === registro.id)
    if (temMov) return { tipo: 'controlado_no_modulo', registro }
    if (v === 0) {
      return (Number(registro.reserva_valor) || 0) > 0
        ? { tipo: 'controlado_no_modulo', registro }
        : { tipo: 'remover', registro }
    }
    if (Number(registro.valor_atual) === v && Number(registro.valor_aplicado) === v) return { tipo: 'nenhum', registro }
    if ((Number(registro.reserva_valor) || 0) > v) return { tipo: 'invalido', motivo: 'O valor é menor que a parte vinculada à reserva. Ajuste em Investimentos.' }
    return { tipo: 'atualizar', registro, dados: { valor_aplicado: v, valor_atual: v } }
  }
  if (v === 0) return { tipo: 'nenhum', registro: null }
  return {
    tipo: 'criar',
    dados: {
      nome: NOME_PATRIMONIO_INICIAL,
      categoria: 'outro',
      valor_aplicado: v,
      valor_atual: v,
      objetivo: 'Informado no onboarding. Detalhe por ativo em Investimentos.',
    },
  }
}

export function totalInvestido(investimentos = []) {
  return Math.round(investimentos.reduce((s, i) => s + (Number(i.valor_atual) || 0), 0) * 100) / 100
}

// ── Metas (Etapa 7) ──────────────────────────────────────────────────────────
export function validarMeta({ nome, valor_desejado, valor_atual, prazo }, hojeISO) {
  if (!String(nome || '').trim()) return 'Dê um nome à meta (ex.: Viagem).'
  const alvo = Number(valor_desejado) || 0
  if (!(alvo > 0)) return 'Informe o valor desejado da meta.'
  const inicial = Number(valor_atual) || 0
  if (inicial < 0) return 'O valor inicial não pode ser negativo.'
  if (inicial > alvo) return 'O valor inicial não pode ser maior que o valor desejado.'
  if (prazo && hojeISO && prazo < hojeISO) return 'O prazo precisa ser uma data futura.'
  return null
}

// ── Resumo final ─────────────────────────────────────────────────────────────
// Só inclui o que foi REALMENTE cadastrado (nada de valores zerados ou
// estimativas calculadas por fórmula própria).
export function itensResumoFinal(d) {
  const itens = []
  const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
  if (d.nome) itens.push({ id: 'perfil', label: 'Perfil', valor: d.nome })
  if (d.objetivos?.length) {
    const nomes = d.objetivos.map(id => OBJETIVOS_FINANCEIROS.find(o => o.id === id)?.label).filter(Boolean)
    itens.push({ id: 'objetivos', label: 'Objetivos', valor: nomes.join(', ') })
  }
  if (d.saldoConfigurado) itens.push({ id: 'saldo', label: 'Saldo em contas', valor: brl(d.saldo) })
  if ((Number(d.patrimonio) || 0) > 0) itens.push({ id: 'patrimonio', label: 'Patrimônio investido', valor: brl(d.patrimonio) })
  if (d.qtdReceitas > 0) itens.push({ id: 'receitas', label: 'Receitas', valor: plural(d.qtdReceitas, 'cadastrada', 'cadastradas') })
  if (d.qtdBeneficios > 0) itens.push({ id: 'beneficios', label: 'Benefícios VR/VA', valor: plural(d.qtdBeneficios, 'cadastrado', 'cadastrados') })
  if (d.qtdDespesas > 0) itens.push({ id: 'despesas', label: 'Despesas', valor: plural(d.qtdDespesas, 'cadastrada', 'cadastradas') })
  if (d.qtdCartoes > 0) itens.push({ id: 'cartoes', label: 'Cartões', valor: plural(d.qtdCartoes, 'cartão', 'cartões') })
  if (d.qtdMetas > 0) itens.push({ id: 'metas', label: 'Metas', valor: plural(d.qtdMetas, 'meta', 'metas') })
  if (d.reservaConfigurada) itens.push({ id: 'reserva', label: 'Reserva de emergência', valor: `${brl(d.reservaAtual)} · ${d.reservaPct}% da renda/mês` })
  if (d.tema) itens.push({ id: 'tema', label: 'Aparência', valor: { claro: 'Claro', escuro: 'Escuro', automatico: 'Automático' }[d.tema] || d.tema })
  return itens
}
