
import { semAcentos } from './importacaoLeitura.js'
import { classificarDespesa } from './classificarDespesa.js'

// Tipos aceitos
export const CONTEXTOS = [
  'extrato',
  'fatura',
  'investimentos',
  'beneficios',
]

export const ROTULOS_TIPO = {
  receita: 'Receita',
  despesa: 'Despesa',
  transferencia: 'Transferência entre contas',
  pagamento_fatura: 'Pagamento de fatura',
  investimento: 'Aplicação/resgate (investimento)',
  estorno: 'Estorno/devolução',
  compra: 'Compra no cartão',
  aporte: 'Aporte',
  resgate: 'Resgate',
  rendimento: 'Rendimento',
  dividendo: 'Dividendo',
  juros: 'Juros/JCP',
  amortizacao: 'Amortização',
  taxa: 'Taxa/imposto',
  indefinido: 'Definir tipo',
  compra_beneficio: 'Compra com VR/VA',
  recarga: 'Recarga',
  ajuste: 'Ajuste',
  estorno_beneficio: 'Estorno/devolução',
}

export const TIPOS_POR_CONTEXTO = {
  extrato: [
    'receita', 'despesa', 'transferencia',
    'pagamento_fatura', 'investimento', 'estorno',
  ],
  fatura: ['compra', 'pagamento_fatura', 'estorno'],
  investimentos: [
    'aporte', 'resgate', 'rendimento', 'dividendo',
    'juros', 'amortizacao', 'taxa', 'indefinido',
  ],
  beneficios: [
    'compra_beneficio', 'recarga', 'ajuste',
    'estorno_beneficio',
  ],
}

const TIPOS_MOV = [
  'aporte', 'resgate', 'rendimento',
  'dividendo', 'juros', 'amortizacao',
]

const TIPOS_BENEFICIOS = [
  'compra_beneficio', 'recarga', 'ajuste',
]

export const TIPOS_IMPORTAVEIS = [
  'receita', 'despesa', 'compra',
  ...TIPOS_MOV,
  ...TIPOS_BENEFICIOS,
]

export function destinoDoTipo(tipo) {
  if (tipo === 'receita') return 'receitas'
  if (tipo === 'despesa') return 'despesas'
  if (tipo === 'compra') return 'compras_cartao'
  if (TIPOS_MOV.includes(tipo)) {
    return 'investimentos_movimentacoes'
  }
  if (TIPOS_BENEFICIOS.includes(tipo)) {
    return 'beneficios_movimentacoes'
  }
  return null
}

export const MOTIVO_NAO_IMPORTAVEL = {
  transferencia:
    'Transferência entre suas contas não é receita nem despesa.',
  pagamento_fatura:
    'As compras do cartão já entram pela fatura; importar o pagamento contaria o gasto duas vezes.',
  investimento:
    'Aplicações e resgates ficam no módulo Investimentos, separados do saldo disponível.',
  estorno:
    'Estorno não é renda. Se precisar, reclassifique ou ajuste a compra original.',
  taxa:
    'O módulo Investimentos não registra taxas e impostos como movimentação.',
  indefinido:
    'Escolha o tipo da movimentação para poder importar.',
  estorno_beneficio:
    'Estorno no benefício: ajuste a compra original ou reclassifique como ajuste.',
}

export const normalizar = s =>
  semAcentos(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function descricaoComparavel(s) {
  return normalizar(s)
    .split(' ')
    .filter(t => t && !/^\d+$/.test(t))
    .join(' ')
}

// Classificação de movimentações
const RE = {
  pagamentoFatura:
    /\b(pagamento|pgto|pagto|pag)( de| da| do)? (fatura|cartao)\b|\bfatura (do )?cartao\b|\bpagamento recebido\b|\bcredito de pagamento\b|\bpagamento efetuado\b/,
  transferenciaPropria:
    /mesma titularidade|entre contas|conta propria|transferencia propria|\bpara (minha|mesma) conta\b|transf(erencia)? entre/,
  rendimento:
    /\brendimento|\brend pago|\bremuneracao (da )?(poupanca|aplicacao)/,
  investimento:
    /\baplicacao|\baplic\b|\bresgate|\bcdb\b|\blci\b|\blca\b|tesouro direto|\bcorretora\b|\binvest/,
  estorno:
    /\bestorno|\bdevolucao|\bchargeback|\bcancelamento de compra/,
  salario:
    /\bsalario|\bfolha( de)? pagamento|\bproventos?\b|\bpagto salario|\bvencimentos\b/,
  transferencia:
    /\bpix\b|\bted\b|\bdoc\b|\btransf/,
  reembolso:
    /\breembolso|\bcashback/,
}

const RE_INV = [
  ['taxa', /\btaxa|\btarifa|\bimposto|\bir\b|\birrf\b|\biof\b|custodia|corretagem|emolumento/],
  ['dividendo', /dividendo/],
  ['juros', /\bjcp\b|juros sobre capital|juros/],
  ['amortizacao', /amortizacao/],
  ['rendimento', /rendimento|remuneracao|cupom|provento/],
  ['resgate', /resgate|venda|retirada|vencimento/],
  ['aporte', /aplicacao|aporte|compra|deposito|subscricao/],
]

const RE_BENEFICIOS = [
  ['estorno_beneficio', /\bestorno|\bdevolucao|\bcancelamento|\bchargeback/],
  ['recarga', /\brecarga|\bcredito|\bdeposito|\baporte|\bcarga/],
  ['ajuste', /\bajuste|\bcorrecao/],
]

export function sinalDeCompraNaFatura(transacoes) {
  let positivos = 0
  let negativos = 0

  for (const t of transacoes) {
    if (RE.pagamentoFatura.test(normalizar(t.descricao))) {
      continue
    }

    if (t.valor > 0) positivos++
    else if (t.valor < 0) negativos++
  }

  return negativos > positivos ? -1 : 1
}

export function classificar(
  t,
  contexto,
  { sinalCompra = 1 } = {}
) {
  const d = normalizar(
    `${t.descricao} ${t.tipoInformado || ''}`
  )
  const avisos = []

  if (contexto === 'fatura') {
    if (RE.pagamentoFatura.test(d)) {
      return {
        tipo: 'pagamento_fatura',
        incluir: false,
        revisar: false,
        avisos,
      }
    }

    if (Math.sign(t.valor) !== sinalCompra) {
      return {
        tipo: 'estorno',
        incluir: false,
        revisar: false,
        avisos: [
          'Crédito na fatura (estorno ou ajuste), não é compra',
        ],
      }
    }

    const revisar = !!t.parcelaTotal

    if (revisar) {
      avisos.push(
        `Parcela ${t.parcelaAtual}/${t.parcelaTotal}: confirme se a data é a da compra original`
      )
    }

    return {
      tipo: 'compra',
      incluir: true,
      revisar,
      avisos,
    }
  }

  if (contexto === 'beneficios') {
    for (const [tipo, regra] of RE_BENEFICIOS) {
      if (!regra.test(d)) continue

      if (tipo === 'estorno_beneficio') {
        return {
          tipo,
          incluir: false,
          revisar: false,
          avisos: [
            'Estorno: ajuste a compra original ou reclassifique como ajuste',
          ],
        }
      }

      return {
        tipo,
        incluir: true,
        revisar: false,
        avisos,
      }
    }

    if (t.valor > 0) {
      return {
        tipo: 'recarga',
        incluir: true,
        revisar: false,
        avisos,
      }
    }

    if (t.valor < 0) {
      return {
        tipo: 'compra_beneficio',
        incluir: true,
        revisar: false,
        avisos,
      }
    }

    return {
      tipo: 'ajuste',
      incluir: false,
      revisar: true,
      avisos: ['Valor zero: escolha o tipo'],
    }
  }

  if (contexto === 'investimentos') {
    for (const [tipo, regra] of RE_INV) {
      if (!regra.test(d)) continue

      if (tipo === 'taxa') {
        return {
          tipo,
          incluir: false,
          revisar: false,
          avisos,
        }
      }

      if (/\bcompra\b|\bvenda\b/.test(d)) {
        avisos.push(
          'Compra/venda: só o valor é registrado; quantidade e preço médio não são alterados'
        )
      }

      return {
        tipo,
        incluir: true,
        revisar: false,
        avisos,
      }
    }

    return {
      tipo: 'indefinido',
      incluir: false,
      revisar: true,
      avisos: ['Não identificamos o tipo da movimentação'],
    }
  }

  // Extrato bancário
  if (RE.pagamentoFatura.test(d)) {
    return {
      tipo: 'pagamento_fatura',
      incluir: false,
      revisar: false,
      avisos,
    }
  }

  if (RE.transferenciaPropria.test(d)) {
    return {
      tipo: 'transferencia',
      incluir: false,
      revisar: false,
      avisos,
    }
  }

  if (t.valor > 0 && RE.rendimento.test(d)) {
    return {
      tipo: 'receita',
      incluir: true,
      revisar: false,
      avisos,
    }
  }

  if (RE.investimento.test(d)) {
    return {
      tipo: 'investimento',
      incluir: false,
      revisar: false,
      avisos,
    }
  }

  if (t.sinalIncerto) {
    return {
      tipo: t.valor > 0 ? 'receita' : 'despesa',
      incluir: false,
      revisar: true,
      avisos: [
        'O PDF não indica se é entrada ou saída: escolha o tipo e marque para importar',
      ],
    }
  }

  if (t.valor > 0 && RE.estorno.test(d)) {
    return {
      tipo: 'estorno',
      incluir: false,
      revisar: false,
      avisos,
    }
  }

  if (t.valor > 0) {
    if (RE.salario.test(d) || RE.reembolso.test(d)) {
      return {
        tipo: 'receita',
        incluir: true,
        revisar: false,
        avisos,
      }
    }

    if (RE.transferencia.test(d)) {
      return {
        tipo: 'receita',
        incluir: false,
        revisar: true,
        avisos: [
          'Transferência recebida: inclua apenas se não veio de outra conta sua',
        ],
      }
    }

    return {
      tipo: 'receita',
      incluir: true,
      revisar: false,
      avisos,
    }
  }

  if (RE.transferencia.test(d)) {
    return {
      tipo: 'despesa',
      incluir: true,
      revisar: true,
      avisos: [
        'Se foi para uma conta sua, mude para Transferência entre contas',
      ],
    }
  }

  return {
    tipo: 'despesa',
    incluir: true,
    revisar: false,
    avisos,
  }
}

// Categorias
const REGRAS_DESPESA = [
  [/supermercado|\bmercado\b|atacad|padaria|restaurante|ifood|lanchonete|acougue|hortifruti|pizzaria|burger|mc ?donald|rappi/, ['Alimentação']],
  [/\buber\b|\b99 ?(app|pop|taxi)?\b|\bposto\b|combustivel|gasolina|estacionamento|pedagio|sem parar|\bmetro\b|onibus|bilhete unico/, ['Transporte']],
  [/farmacia|drogaria|droga ?raia|drogasil|pague menos|hospital|clinica|laboratorio|unimed|odonto|dentista/, ['Saúde']],
  [/aluguel|condominio|\benel\b|cemig|copel|\blight\b|sabesp|celesc|energia eletrica|conta de luz|agua e esgoto|comgas/, ['Moradia']],
  [/internet|vivo fibra|claro net|net virtua|oi fibra|tim live/, ['Internet']],
  [/netflix|spotify|amazon prime|prime video|disney|\bhbo\b|youtube premium|apple com|deezer|globoplay|paramount/, ['Serviços']],
  [/\bescola\b|faculdade|universidade|\bcurso\b|udemy|alura/, ['Educação']],
  [/cinema|ingresso|teatro|steam|playstation|xbox/, ['Lazer']],
  [/petshop|pet shop|veterinari|cobasi|\bpetz\b/, ['Pets']],
  [/renner|riachuelo|\bc a\b|\bzara\b|shein|calcados|netshoes/, ['Vestuário']],
  [/\btarifa|\biof\b|anuidade|cesta de servicos|\bencargos?\b/, ['Serviços']],
]

const REGRAS_RECEITA = [
  [RE.salario, ['Salário']],
  [RE.rendimento, ['Rendimentos']],
  [/dividendo|\bjcp\b/, ['Dividendos / JCP']],
  [RE.reembolso, ['Reembolso']],
]

function acharCategoria(nomes, categorias) {
  for (const nome of nomes) {
    const encontrada = categorias.find(
      c => normalizar(c.nome) === normalizar(nome)
    )
    if (encontrada) return encontrada
  }
  return null
}

export function sugerirCategoria(
  descricao,
  tipo,
  categorias = []
) {
  const regras =
    tipo === 'receita'
      ? REGRAS_RECEITA
      : ['despesa', 'compra'].includes(tipo)
        ? REGRAS_DESPESA
        : null

  if (!regras) return null

  const descricaoNormalizada = normalizar(descricao)
  const encontradas = new Map()

  for (const [regra, nomes] of regras) {
    if (!regra.test(descricaoNormalizada)) continue
    const categoria = acharCategoria(nomes, categorias)
    if (categoria) encontradas.set(categoria.id, categoria)
  }

  return encontradas.size === 1
    ? [...encontradas.values()][0]
    : null
}

// Identificação de duplicidades
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909)

  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return (
    4294967296 * (2097151 & h2) +
    (h1 >>> 0)
  ).toString(36)
}

export const centavos = valor =>
  Math.round(Math.abs(Number(valor) || 0) * 100)

export function chavesDosItens(transacoes, origem) {
  const ocorrencias = new Map()

  return transacoes.map(t => {
    const base = t.idOrigem
      ? `${origem}|id:${t.idOrigem}`
      : `${origem}|${t.data}|${centavos(t.valor)}|${t.valor < 0 ? 's' : 'e'}|${descricaoComparavel(t.descricao)}`

    const quantidade = (ocorrencias.get(base) || 0) + 1
    ocorrencias.set(base, quantidade)

    return {
      chave: hash53(
        t.idOrigem ? base : `${base}#${quantidade}`
      ),
      repetidoPorId: Boolean(t.idOrigem && quantidade > 1),
      repetidoSemId: Boolean(!t.idOrigem && quantidade > 1),
    }
  })
}

function tokens(s) {
  return new Set(
    descricaoComparavel(s)
      .split(' ')
      .filter(t => t.length >= 3)
  )
}

export function similaridade(a, b) {
  const ta = tokens(a)
  const tb = tokens(b)

  if (!ta.size || !tb.size) return 0

  let intersecao = 0
  for (const t of ta) {
    if (tb.has(t)) intersecao++
  }

  if (intersecao === Math.min(ta.size, tb.size)) {
    return 1
  }

  return intersecao / (ta.size + tb.size - intersecao)
}

function diasEntre(a, b) {
  return Math.abs(
    (
      Date.parse(`${a}T12:00:00Z`) -
      Date.parse(`${b}T12:00:00Z`)
    ) / 86400000
  )
}

export function normalizarExistentes(tabela, linhas = []) {
  return linhas.map(registro => {
    if (tabela === 'compras_cartao') {
      const parcelas = Math.max(
        1,
        Number(registro.numero_parcelas) || 1
      )

      return {
        id: registro.id,
        tabela,
        data: registro.data_compra,
        valores: [
          centavos(registro.valor_total),
          centavos(
            (Number(registro.valor_total) || 0) / parcelas
          ),
        ],
        descricao: registro.descricao,
        cartaoId: registro.cartao_id,
      }
    }

    if (tabela === 'investimentos_movimentacoes') {
      return {
        id: registro.id,
        tabela,
        data: registro.data,
        valores: [centavos(registro.valor)],
        descricao: registro.descricao || registro.tipo,
        investimentoId: registro.investimento_id,
        tipo: registro.tipo,
      }
    }

    if (tabela === 'beneficios_movimentacoes') {
      return {
        id: registro.id,
        tabela,
        data: registro.data,
        valores: [centavos(registro.valor)],
        descricao: registro.descricao || registro.tipo,
        beneficioId: registro.beneficio_id,
        tipo: registro.tipo,
      }
    }

    return {
      id: registro.id,
      tabela,
      data: registro.data,
      valores: [centavos(registro.valor)],
      descricao: registro.descricao,
    }
  })
}

export function marcarDuplicidades(
  itens,
  {
    existentes = [],
    chavesImportadas = new Set(),
  } = {}
) {
  const usados = new Set()

  return itens.map(item => {
    const avisos = [...(item.avisos || [])]

    if (item.repetidoPorId) {
      return {
        ...item,
        status: 'duplicado_no_arquivo',
        incluir: false,
        avisos: [
          ...avisos,
          'Mesmo identificador bancário repetido no arquivo',
        ],
      }
    }

    if (chavesImportadas.has(item.chave)) {
      return {
        ...item,
        status: 'ja_importado',
        incluir: false,
        avisos: [...avisos, 'Já importado anteriormente'],
      }
    }

    const destino = destinoDoTipo(item.tipo)

    if (!destino) {
      return {
        ...item,
        status: 'novo',
        avisos,
      }
    }

    const valor = centavos(item.valor)

    let melhor = null
    let melhorPontos = 0

    for (const existente of existentes) {
      if (usados.has(existente.id)) continue
      if (existente.tabela !== destino) continue

      if (
        existente.cartaoId &&
        item.cartaoId &&
        existente.cartaoId !== item.cartaoId
      ) continue

      if (
        existente.investimentoId &&
        item.investimentoId &&
        existente.investimentoId !== item.investimentoId
      ) continue

      if (
        existente.beneficioId &&
        item.beneficioId &&
        existente.beneficioId !== item.beneficioId
      ) continue

      if (!existente.valores.includes(valor)) continue

      const dias = diasEntre(existente.data, item.data)
      if (dias > 3) continue

      const sim = similaridade(
        existente.descricao,
        item.descricao
      )

      const pontos =
        (dias === 0 ? 2 : 1) + sim * 2

      if (
        (dias === 0 || sim >= 0.6) &&
        pontos > melhorPontos
      ) {
        melhor = { existente, sim, dias }
        melhorPontos = pontos
      }
    }

    if (!melhor) {
      const extra = item.repetidoSemId
        ? [
            'Lançamento igual a outro do arquivo: mantido, pois pode ser uma segunda compra',
          ]
        : []

      return {
        ...item,
        status: 'novo',
        avisos: [...avisos, ...extra],
      }
    }

    usados.add(melhor.existente.id)

    const forte = melhor.sim >= 0.34

    return {
      ...item,
      status: forte
        ? 'possivel_duplicata'
        : 'possivel_duplicata_fraca',
      incluir: forte ? false : item.incluir,
      duplicataDe: melhor.existente.id,
      avisos: [
        ...avisos,
        forte
          ? 'Parece já estar cadastrado (mesma data, valor e descrição semelhante)'
          : 'Há um lançamento com mesma data e valor, mas descrição diferente: confira',
      ],
    }
  })
}

// Preparação dos lançamentos
export function investimentoDoAtivo(
  ativo,
  investimentos,
  padrao
) {
  if (!ativo || !investimentos?.length) {
    return { id: padrao, incerto: false }
  }

  const nome = normalizar(ativo)

  const encontrados = investimentos.filter(i => {
    const n = normalizar(i.nome)
    return n && (
      n === nome ||
      n.includes(nome) ||
      nome.includes(n)
    )
  })

  if (encontrados.length === 1) {
    return {
      id: encontrados[0].id,
      incerto: false,
    }
  }

  return {
    id: padrao,
    incerto: true,
  }
}

export function prepararItens(
  transacoes,
  {
    contexto,
    origem,
    categorias = [],
    existentes = [],
    chavesImportadas = new Set(),
    cartaoId = null,
    investimentoId = null,
    beneficioId = null,
    investimentos = [],
    beneficios = [],
  }
) {
  const sinalCompra = contexto === 'fatura'
    ? sinalDeCompraNaFatura(transacoes)
    : 1

  const chaves = chavesDosItens(transacoes, origem)

  const itens = transacoes.map((transacao, indice) => {
    const c = classificar(
      transacao,
      contexto,
      { sinalCompra }
    )

    const categoria = sugerirCategoria(
      transacao.descricao,
      c.tipo,
      categorias
    )

    const inv = contexto === 'investimentos'
      ? investimentoDoAtivo(
          transacao.ativo,
          investimentos,
          investimentoId
        )
      : {
          id: investimentoId,
          incerto: false,
        }

    if (inv.incerto) {
      c.revisar = true
      c.avisos.push(
        `Ativo "${transacao.ativo}" não corresponde a um investimento cadastrado`
      )
    }

    return {
      uid: `i${indice + 1}`,
      linha: transacao.linha,
      data: transacao.data,
      descricao: transacao.descricao,
      valor: Math.abs(transacao.valor),
      entrada: contexto === 'fatura'
        ? Math.sign(transacao.valor) !== sinalCompra
        : transacao.valor > 0,
      idOrigem: transacao.idOrigem,
      parcelaAtual: transacao.parcelaAtual,
      parcelaTotal: transacao.parcelaTotal,
      ativo: transacao.ativo,
      tipo: c.tipo,
      incluir: c.incluir,
      revisar: c.revisar || !!transacao.revisar,
      avisos: [
        ...(transacao.avisos || []),
        ...c.avisos,
      ],
      categoriaId:
        categoria && c.tipo !== 'receita'
          ? categoria.id
          : null,
      categoriaNome:
        categoria && c.tipo === 'receita'
          ? categoria.nome
          : null,
      cartaoId,
      investimentoId: inv.id,
      beneficioId,
      ...chaves[indice],
    }
  })

  return marcarDuplicidades(itens, {
    existentes,
    chavesImportadas,
  })
}

export function alterarTipo(item, tipo) {
  const importavel = TIPOS_IMPORTAVEIS.includes(tipo)

  return {
    ...item,
    tipo,
    incluir: importavel
      ? item.incluir || item.tipo === 'indefinido'
      : false,
    categoriaId:
      tipo === 'receita' ? null : item.categoriaId,
    categoriaNome:
      tipo === 'receita' ? item.categoriaNome : null,
  }
}

// Validação dos itens
export function validarItem(item) {
  if (!item.incluir) return null

  if (!TIPOS_IMPORTAVEIS.includes(item.tipo)) {
    return 'Tipo não importável'
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.data || '')) {
    return 'Data inválida'
  }

  if (!(Number(item.valor) > 0)) {
    return 'Valor deve ser maior que zero'
  }

  if (!String(item.descricao || '').trim()) {
    return 'Descrição obrigatória'
  }

  if (item.tipo === 'compra' && !item.cartaoId) {
    return 'Escolha o cartão'
  }

  if (
    TIPOS_MOV.includes(item.tipo) &&
    !item.investimentoId
  ) {
    return 'Escolha o investimento'
  }

  if (
    TIPOS_BENEFICIOS.includes(item.tipo) &&
    !item.beneficioId
  ) {
    return 'Escolha o benefício'
  }

  return null
}

const arredondar = valor =>
  Math.round((Number(valor) + Number.EPSILON) * 100) / 100

export function montarRegistros(
  itens,
  { categorias = [] } = {}
) {
  const porId = Object.fromEntries(
    categorias.map(categoria => [
      categoria.id,
      categoria,
    ])
  )

  const resultado = {
    receitas: [],
    despesas: [],
    compras_cartao: [],
    investimentos_movimentacoes: [],
    beneficios_movimentacoes: [],
    erros: [],
  }

  for (const item of itens) {
    if (!item.incluir) continue

    const problema = validarItem(item)

    if (problema) {
      resultado.erros.push({
        uid: item.uid,
        problema,
      })
      continue
    }

    const descricao = String(item.descricao)
      .trim()
      .slice(0, 200)

    const valor = arredondar(item.valor)
    const ref = {
      uid: item.uid,
      chave: item.chave,
    }

    if (item.tipo === 'receita') {
      resultado.receitas.push({
        ref,
        dados: {
          descricao,
          valor,
          data: item.data,
          recorrente: false,
          frequencia: 'nao_repete',
          recorrencia_meses: null,
          categoria: item.categoriaNome || null,
        },
      })
    } else if (item.tipo === 'despesa') {
      const categoria = porId[item.categoriaId]

      resultado.despesas.push({
        ref,
        dados: {
          descricao,
          valor,
          data: item.data,
          recorrente: false,
          frequencia: 'nao_repete',
          recorrencia_meses: null,
          categoria_id: item.categoriaId || null,
          subcategoria_id: null,
          tipo_despesa: classificarDespesa({
            descricao,
            categoria: categoria?.nome || '',
          }),
          forma_pagamento: null,
          cartao_id: null,
        },
      })
    } else if (item.tipo === 'compra') {
      const parcelas =
        item.parcelaTotal && item.parcelaTotal > 1
          ? item.parcelaTotal
          : 1

      resultado.compras_cartao.push({
        ref,
        dados: {
          cartao_id: item.cartaoId,
          descricao,
          data_compra: item.data,
          valor_total: arredondar(valor * parcelas),
          numero_parcelas: parcelas,
          categoria_id: item.categoriaId || null,
        },
      })
    } else if (TIPOS_BENEFICIOS.includes(item.tipo)) {
      const tipoBanco =
        item.tipo === 'compra_beneficio'
          ? 'compra'
          : item.tipo === 'estorno_beneficio'
            ? 'estorno'
            : item.tipo

      resultado.beneficios_movimentacoes.push({
        ref,
        dados: {
          beneficio_id: item.beneficioId,
          tipo: tipoBanco,
          valor,
          descricao,
          data: item.data,
          competencia: null,
          automatica: false,
        },
      })
    } else {
      resultado.investimentos_movimentacoes.push({
        ref,
        dados: {
          investimento_id: item.investimentoId,
          tipo: item.tipo,
          valor,
          data: item.data,
          descricao,
        },
      })
    }
  }

  return resultado
}

// Impacto no saldo
export function impactoNoSaldo(
  itens,
  {
    saldoBaseData = null,
    hoje,
  }
) {
  let delta = 0
  let noPeriodo = 0
  let antesDaBase = 0
  let futuros = 0

  for (const item of itens) {
    if (!item.incluir || validarItem(item)) continue

    if (
      item.tipo !== 'receita' &&
      item.tipo !== 'despesa'
    ) {
      continue
    }

    if (item.data > hoje) {
      futuros++
      continue
    }

    if (!saldoBaseData) continue

    if (item.data <= saldoBaseData) {
      antesDaBase++
      continue
    }

    noPeriodo++

    delta += item.tipo === 'receita'
      ? item.valor
      : -item.valor
  }

  return {
    delta: arredondar(delta),
    noPeriodo,
    antesDaBase,
    futuros,
    saldoConfigurado: !!saldoBaseData,
  }
}

// Resumo financeiro
export function resumoImportacao(itens) {
  const resumo = {
    total: itens.length,
    selecionados: 0,
    valorSelecionado: 0,
    incluidos: 0,
    porTipo: {},
    entradas: 0,
    saidas: 0,
    duplicidades: 0,
    revisar: 0,
    ignorados: 0,
    comErro: 0,
  }

  for (const item of itens) {
    resumo.porTipo[item.tipo] =
      (resumo.porTipo[item.tipo] || 0) + 1

    if (
      [
        'possivel_duplicata',
        'possivel_duplicata_fraca',
        'ja_importado',
        'duplicado_no_arquivo',
      ].includes(item.status)
    ) {
      resumo.duplicidades++
    }

    if (item.revisar) resumo.revisar++

    if (!item.incluir) {
      resumo.ignorados++
      continue
    }

    resumo.selecionados++

    resumo.valorSelecionado = arredondar(
      resumo.valorSelecionado +
      Math.abs(Number(item.valor) || 0)
    )

    if (validarItem(item)) {
      resumo.comErro++
      continue
    }

    resumo.incluidos++

    if (
      item.tipo === 'receita' ||
      [
        'resgate',
        'rendimento',
        'dividendo',
        'juros',
        'amortizacao',
      ].includes(item.tipo)
    ) {
      resumo.entradas = arredondar(
        resumo.entradas + item.valor
      )
    } else {
      resumo.saidas = arredondar(
        resumo.saidas + item.valor
      )
    }
  }

  return resumo
}

export function intervaloDatas(transacoes) {
  const datas = transacoes
    .map(t => t.data)
    .filter(Boolean)
    .sort()

  return datas.length
    ? {
        inicio: datas[0],
        fim: datas[datas.length - 1],
      }
    : null
}