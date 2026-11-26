
import { useDespesas } from './useDespesas'

const PALAVRAS = [
  'netflix', 'spotify', 'amazon prime', 'disney',
  'hbo', 'max', 'apple music', 'apple one',
  'youtube', 'google one', 'microsoft 365',
  'adobe', 'dropbox', 'icloud', 'onedrive',
  'assinatura', 'mensalidade', 'academia',
  'gym', 'internet', 'celular', 'telefonia',
  'tv', 'streaming', 'subscription',
  'seguro', 'antivirus', 'telemedicina',
  'plano de saude', 'plano odontologico'
]

const EXCLUIR = [
  'aluguel', 'emprestimo', 'financiamento',
  'gasolina', 'combustivel', 'etanol',
  'diesel', 'supermercado', 'mercado',
  'alimentacao', 'restaurante', 'farmacia',
  'condominio', 'iptu', 'ipva',
  'energia eletrica', 'conta de luz',
  'conta de agua', 'fatura de cartao',
  'consorcio', 'prestacao'
]

const CATEGORIAS_ASSINATURAS = [
  'assinaturas',
  'streaming',
  'telefonia',
  'internet',
  'seguros',
  'academia',
  'servicos digitais'
]

const CATEGORIAS_EXCLUIDAS = [
  'emprestimos',
  'financiamentos',
  'dividas',
  'transporte',
  'combustivel',
  'alimentacao',
  'supermercado',
  'impostos'
]

const DIA = 86400000

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function contemPalavra(texto, palavra) {
  const textoLimpo = normalizar(texto)
    .replace(/[^a-z0-9]+/g, ' ')

  return (` ${textoLimpo} `)
    .includes(` ${normalizar(palavra)} `)
}

function obterCategoria(d) {
  return typeof d.categoria === 'string'
    ? d.categoria
    : d.categoria?.nome ||
      d.categorias?.nome ||
      ''
}

function dataValida(valor) {
  if (typeof valor !== 'string') return null

  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/
    .exec(valor)

  if (!m) return null

  const [, a, b, c] = m
  const d = new Date(Date.UTC(+a, +b - 1, +c))

  return (
    d.getUTCFullYear() === +a &&
    d.getUTCMonth() === +b - 1 &&
    d.getUTCDate() === +c
  ) ? d : null
}

function iso(data) {
  return data.toISOString().slice(0, 10)
}

function adicionarMeses(data, quantidade) {
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + quantidade

  const ultimoDia = new Date(
    Date.UTC(ano, mes + 1, 0)
  ).getUTCDate()

  return new Date(
    Date.UTC(
      ano,
      mes,
      Math.min(data.getUTCDate(), ultimoDia)
    )
  )
}

export function calcularAssinaturas(
  despesas,
  agora = new Date()
) {
  const hoje = new Date(
    Date.UTC(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate()
    )
  )

  const grupos = new Map()

  for (const d of Array.isArray(despesas)
    ? despesas
    : []) {

    if (
      !d ||
      d.deleted_at ||
      d.excluido_em ||
      d.excluido === true ||
      d.is_deleted === true
    ) continue

    const status = normalizar(d.status)

    if (
      ['excluido', 'excluida', 'deleted']
        .includes(status)
    ) continue

    const descricao = normalizar(d.descricao)
    const categoria = normalizar(obterCategoria(d))
    const valor = Number(d.valor)

    if (
      !descricao ||
      !Number.isFinite(valor) ||
      valor <= 0
    ) continue

    // Excluir despesas que nao sao assinaturas
    const despesaExcluida = EXCLUIR.some(
      p => contemPalavra(descricao, p)
    )

    const categoriaExcluida =
      CATEGORIAS_EXCLUIDAS.some(
        c => contemPalavra(categoria, c)
      )

    if (despesaExcluida || categoriaExcluida) {
      continue
    }

    // Identificar exclusivamente servicos recorrentes
    const palavraAssinatura = PALAVRAS.some(
      p => contemPalavra(descricao, p)
    )

    const categoriaAssinatura =
      CATEGORIAS_ASSINATURAS.some(
        c => contemPalavra(categoria, c)
      )

    // Ser uma despesa fixa nao basta
    if (!palavraAssinatura && !categoriaAssinatura) {
      continue
    }

    const data =
      dataValida(d.data_vencimento) ||
      dataValida(d.data)

    const cancelada =
      d.cancelado === true ||
      d.cancelada === true ||
      [
        'cancelado',
        'cancelada',
        'canceled',
        'cancelled'
      ].includes(status)

    const fixa =
      d.fixa === true ||
      d.recorrente === true ||
      normalizar(d.tipo) === 'fixa'

    const item = {
      d,
      data,
      valor,
      cancelada,
      fixa
    }

    if (!grupos.has(descricao)) {
      grupos.set(descricao, [])
    }

    grupos.get(descricao).push(item)
  }

  const resultado = []

  for (const [chave, grupo] of grupos) {

    const validas = grupo
      .filter(x => !x.cancelada)
      .sort((a, b) =>
        (b.data?.getTime() || 0) -
        (a.data?.getTime() || 0)
      )

    const historico = validas.filter(
      x => x.data && x.data <= hoje
    )

    const futuros = validas
      .filter(x => x.data && x.data > hoje)
      .sort((a, b) => a.data - b.data)

    const ultima = historico[0]

    const atual =
      futuros[0] ||
      validas[0] ||
      grupo[0]

    const dias = ultima
      ? Math.round((hoje - ultima.data) / DIA)
      : null

    const cancelada = validas.length === 0

    const ativa =
      !cancelada &&
      (
        validas.some(x => x.fixa) ||
        futuros.length > 0 ||
        (dias !== null && dias <= 60)
      )

    const situacao = cancelada
      ? 'cancelada'
      : ativa
        ? (
          futuros.length > 0 && !ultima
            ? 'prevista'
            : 'ativa'
        )
        : 'inativa'

    let proximo = futuros[0]?.data || null

    // Projetar vencimentos apenas de despesas recorrentes
    if (
      !proximo &&
      ativa &&
      ultima &&
      validas.some(x => x.fixa)
    ) {
      const base = ultima.data
      let quantidade = 1
      let candidato = adicionarMeses(base, quantidade)

      while (
        candidato <= hoje &&
        quantidade < 1200
      ) {
        quantidade++
        candidato = adicionarMeses(base, quantidade)
      }

      if (candidato > hoje) {
        proximo = candidato
      }
    }

    resultado.push({
      id: atual.d.id ?? chave,
      descricao: atual.d.descricao,
      valorMensal: atual.valor,
      ativa,
      situacao,

      proximoVencimento: proximo
        ? iso(proximo)
        : null,

      ultimaOcorrencia: ultima
        ? iso(ultima.data)
        : null,

      categoria: obterCategoria(atual.d) || null,

      fixa: atual.fixa,

      ocorrencias: validas.length || grupo.length,

      diasDesdeUltima: dias
    })
  }

  const ativas = resultado
    .filter(a => a.ativa)
    .sort((a, b) => b.valorMensal - a.valorMensal)

  const canceladas = resultado.filter(
    a => a.situacao === 'cancelada'
  )

  const inativas = resultado.filter(
    a => a.situacao === 'inativa'
  )

  const totalMensal = ativas.reduce(
    (total, a) =>
      total + Math.round(a.valorMensal * 100),
    0
  ) / 100

  return {
    ativas,
    canceladas,
    inativas,
    todas: resultado,
    totalMensal,
    totalAtivas: ativas.length,
    totalCanceladas: canceladas.length,
    totalInativas: inativas.length
  }
}

export function useAssinaturas() {
  const {
    despesas,
    carregando,
    erro
  } = useDespesas()

  return {
    ...calcularAssinaturas(despesas),
    carregando,
    erro
  }
}