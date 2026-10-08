// Formata valor para Real brasileiro
// ─── Ocultar valores (global) ────────────────────────────────────────────────
// Preferência de ocultar valores financeiros, mantida em nível de módulo para
// que TODA chamada a formatCurrency() seja mascarada automaticamente em todo o
// app (Home, receitas, despesas, cartões, reserva, projeções, Horizonte...),
// sem precisar alterar cada ponto de exibição. É apenas visual: não altera
// nenhum cálculo ou dado. Quem controla o estado é o OcultarValoresProvider,
// que chama definirOcultarValoresGlobal() sempre que a preferência muda.
// Observação: NÃO afeta a digitação monetária (formatarMoedaDigitada,
// moedaParaNumero, numeroParaMoeda), usadas no InputMoeda.
export const MASCARA_VALOR = 'R$ ••••'
let _ocultarValoresGlobal = false
export const definirOcultarValoresGlobal = (v) => { _ocultarValoresGlobal = !!v }

export const formatCurrency = (value) => {
  if (_ocultarValoresGlobal) return MASCARA_VALOR
  // Segurança de EXIBIÇÃO: nunca mostrar "R$ NaN"/"R$ Infinity" ao usuário.
  // Os cálculos financeiros já se protegem com `Number(x) || 0` na origem; este
  // tratamento é só a última barreira visual para um valor inválido que
  // escape até aqui (null/undefined/NaN/Infinity) → exibe R$ 0,00. NÃO altera
  // nenhum cálculo nem esconde um valor numérico real (inclusive negativos).
  const num = Number(value)
  const seguro = Number.isFinite(num) ? num : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(seguro)
}

// ─── "Hoje" no fuso de Brasília ───────────────────────────────────────────────
// FONTE ÚNICA da data de HOJE para toda a lógica financeira (lançamentos do dia,
// gasto do dia, saldo "até hoje", limite diário, Horizonte).
//
// Por que existe: usar new Date().toISOString().split('T')[0] devolve a data em
// UTC. Para quem está no Brasil (UTC−3), das 21h à meia-noite isso já "vira" o
// dia seguinte — fazendo um gasto da noite ser gravado com a data de amanhã e
// sumir do "hoje". Aqui fixamos o dia no fuso America/Sao_Paulo, igual à
// saudação/datas exibidas, para o "hoje" ser consistente.
//
// Importante: isto NÃO altera datas já gravadas (vencimentos/lançamentos) nem o
// cálculo de fim de mês — serve apenas para obter "o dia de hoje".
const TZ_BRASIL = 'America/Sao_Paulo'

// Retorna a data de hoje como 'YYYY-MM-DD' no fuso de Brasília.
// (en-CA formata como ISO curto: 2026-10-07.)
export const hojeISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BRASIL, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

// Partes numéricas de hoje no fuso de Brasília: { ano, mes (1-12), dia }.
// Útil para montar Date "local ao meio-dia" sem risco de deslocamento de fuso.
export const partesHojeBrasil = () => {
  const [ano, mes, dia] = hojeISO().split('-').map(Number)
  return { ano, mes, dia }
}

// Objeto Date representando hoje (meio-dia, para evitar bordas de fuso) com base
// no dia de Brasília. Use quando precisar de um Date e não de string.
export const hojeDateBrasil = () => {
  const { ano, mes, dia } = partesHojeBrasil()
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0)
}

// Formata data para pt-BR
export const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR')
}

// Retorna o nome do mês abreviado + ano (ex: "Out/26")
export const labelMes = (date) => {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`
}

// Retorna o primeiro e último dia de um mês
export const rangeDoMes = (ano, mes) => {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = new Date(ano, mes, 0).toISOString().split('T')[0]
  return { inicio, fim }
}

// Cor de badge de categoria baseada no nome
const CORES_CATEGORIA = {
  'Moradia':       'bg-blue-100 text-blue-700',
  'Alimentação':   'bg-orange-100 text-orange-700',
  'Transporte':    'bg-yellow-100 text-yellow-700',
  'Saúde':         'bg-red-100 text-red-700',
  'Lazer':         'bg-purple-100 text-purple-700',
  'Serviços':      'bg-teal-100 text-teal-700',
  'Internet':      'bg-cyan-100 text-cyan-700',
  'Empréstimos':   'bg-rose-100 text-rose-700',
  'Educação':      'bg-indigo-100 text-indigo-700',
  'Vestuário':     'bg-pink-100 text-pink-700',
  'Pets':          'bg-lime-100 text-lime-700',
  'Eletrônicos':   'bg-blue-100 text-blue-700',
  'Móveis':        'bg-amber-100 text-amber-700',
  'Viagem':        'bg-sky-100 text-sky-700',
  'Salário':       'bg-green-100 text-green-700',
  'Freelance':     'bg-cyan-100 text-cyan-700',
  'Renda extra':   'bg-emerald-100 text-emerald-700',
  'Investimento':  'bg-green-100 text-green-700',
}

export const corCategoria = (nome) =>
  CORES_CATEGORIA[nome] || 'bg-gray-100 text-gray-600'

// ─── WhatsApp / telefone BR ───────────────────────────────────────────────────
// Mantém só dígitos (máx. 11: DDD + 9 dígitos).
export const somenteDigitosTelefone = (v) => String(v || '').replace(/\D/g, '').slice(0, 11)

// Aplica a máscara brasileira (11) 99999-9999 progressivamente.
export const mascararTelefone = (v) => {
  const d = somenteDigitosTelefone(v)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Telefone BR válido = 10 (fixo) ou 11 (celular) dígitos.
export const telefoneValido = (v) => {
  const d = somenteDigitosTelefone(v)
  return d.length === 10 || d.length === 11
}

// Link wa.me a partir dos dígitos (prefixa 55 = Brasil se não vier).
export const linkWhatsApp = (digitos) => {
  const d = String(digitos || '').replace(/\D/g, '')
  const comPais = d.startsWith('55') ? d : `55${d}`
  return `https://wa.me/${comPais}`
}

// Formas de pagamento (valor salvo no banco + rótulo com ícone para exibição)
// Formas de pagamento SELECIONÁVEIS em novos lançamentos (seletores do app).
// "Dinheiro" e "Outro" foram removidos daqui a pedido: não aparecem mais em
// nenhum seletor. Registros antigos salvos com esses valores continuam sendo
// EXIBIDOS normalmente (ver FORMAS_PAGAMENTO_LEGADAS + formaPagamentoLabel).
export const FORMAS_PAGAMENTO = [
  { value: 'cartao_credito',   label: 'Cartão de crédito',  icone: '💳' },
  { value: 'cartao_debito',    label: 'Cartão de débito',   icone: '💳' },
  { value: 'pix',              label: 'Pix',                icone: '⚡' },
  { value: 'boleto',           label: 'Boleto',             icone: '🧾' },
  { value: 'debito_automatico',label: 'Débito automático',  icone: '🏦' },
  { value: 'transferencia',    label: 'Transferência',      icone: '🔄' },
]

// Formas DESCONTINUADAS: não são oferecidas em novos lançamentos, mas ainda
// precisam de rótulo/ícone para exibir corretamente registros antigos que já
// foram salvos no banco com esses valores. Não entram em nenhum <select>.
export const FORMAS_PAGAMENTO_LEGADAS = [
  { value: 'dinheiro',         label: 'Dinheiro',           icone: '💵' },
  { value: 'outro',            label: 'Outro',              icone: '💠' },
]

// Retorna "💳 Cartão de crédito" a partir do valor salvo; vazio se não houver.
// Procura nas formas atuais E nas legadas, para que lançamentos antigos salvos
// como "dinheiro"/"outro" continuem exibidos normalmente nas listas.
export const formaPagamentoLabel = (value) => {
  const f = FORMAS_PAGAMENTO.find(f => f.value === value)
    || FORMAS_PAGAMENTO_LEGADAS.find(f => f.value === value)
  return f ? `${f.icone} ${f.label}` : ''
}

// Estado de carregamento vazio (lista)
export const estadoVazio = (mensagem = 'Nenhum registro encontrado.') => mensagem

// Quantidade de dias restantes no mês, incluindo o dia atual
export const diasRestantesNoMes = (dataRef = new Date()) => {
  const ano = dataRef.getFullYear()
  const mes = dataRef.getMonth()
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  const diaAtual = dataRef.getDate()
  return ultimoDia - diaAtual + 1
}

/**
 * Calcula "Quanto posso gastar hoje?".
 *
 * Fórmula:
 *   orçamento variável disponível = receitas - compromissos(fixas + parcelas do mês) - reserva do mês
 *   saldo variável restante       = orçamento variável disponível - gastos variáveis já realizados
 *   limite diário                 = saldo variável restante / dias restantes (incluindo hoje)
 *
 * As parcelas NÃO são duplicadas: as despesas fixas aqui consideram apenas
 * despesas à vista classificadas como fixa; as parcelas entram separadamente.
 *
 * @returns objeto com os valores calculados ou { indisponivel, motivo }
 */
export const calcularLimiteDiario = ({
  receitaTotal = 0,
  despesasFixas = 0,       // despesas à vista fixas (compromissos)
  parcelasMes = 0,         // soma das parcelas devidas neste mês
  reservaMes = 0,          // meta/reserva financeira do mês
  gastosVariaveisRealizados = 0, // despesas à vista variáveis já lançadas
  gastosVariaveisHoje = 0, // subconjunto realizado hoje
  dataRef = new Date(),
} = {}) => {
  // Precisa de receita para calcular com segurança
  if (receitaTotal <= 0) {
    return {
      indisponivel: true,
      motivo: 'Cadastre sua receita do mês para calcular quanto você pode gastar por dia.',
    }
  }

  const compromissos = despesasFixas + parcelasMes + reservaMes
  const orcamentoVariavel = receitaTotal - compromissos
  const saldoVariavelRestante = orcamentoVariavel - gastosVariaveisRealizados

  const dias = diasRestantesNoMes(dataRef)
  // Limite diário nunca negativo
  const limiteDiario = saldoVariavelRestante > 0 && dias > 0
    ? saldoVariavelRestante / dias
    : 0

  return {
    indisponivel: false,
    limiteDiario,
    orcamentoVariavel,
    saldoVariavelRestante: Math.max(0, saldoVariavelRestante),
    saldoVariavelRestanteReal: saldoVariavelRestante, // pode ser negativo (para alertas)
    gastosVariaveisHoje,
    diasRestantes: dias,
    compromissos,
  }
}

// ─── Máscara monetária brasileira ────────────────────────────────────────────
// Sempre trata os dígitos como centavos: "3874" → R$ 38,74 ; "" → "".
// Formata um texto que contém apenas dígitos em moeda pt-BR.
export const formatarMoedaDigitada = (texto) => {
  const digitos = String(texto ?? '').replace(/\D/g, '')
  if (!digitos) return ''
  const centavos = parseInt(digitos, 10)
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Converte o texto exibido na máscara ("3.874,70") para número (3874.70).
export const moedaParaNumero = (texto) => {
  const digitos = String(texto ?? '').replace(/\D/g, '')
  if (!digitos) return 0
  return parseInt(digitos, 10) / 100
}

// Converte um número (ex.: 3874.7) para o texto da máscara ("3.874,70"),
// usado para pré-preencher o campo ao editar um valor já existente.
export const numeroParaMoeda = (valor) => {
  const n = Number(valor)
  if (!n || isNaN(n)) return ''
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Exibe o valor em moeda ou mascarado ("R$ ••••"), conforme a preferência de
// ocultar valores. Apenas visual — não altera cálculo algum. Mantido por
// compatibilidade com os pontos que já passam o "ocultar" explicitamente; como
// o formatCurrency agora também respeita o estado global, o resultado é o mesmo.
export const exibirMoeda = (value, ocultar) =>
  ocultar ? MASCARA_VALOR : formatCurrency(value)
