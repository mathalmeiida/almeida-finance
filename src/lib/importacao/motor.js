// ─── Motor de leitura (etapas 1 a 5) ─────────────────────────────────────────
// 1. Identificar o tipo do arquivo   2. Extrair os dados
// 3. Reconhecer a instituição        4. Identificar datas e valores
// 5. Interpretar as descrições
// As etapas 6 (classificar), 7 (duplicidades) e 8 (prévia) ficam em
// analisar.js, pois dependem dos dados já cadastrados do usuário.
// Este módulo roda dentro de um Web Worker (isolado da interface) e também em
// Node, nos testes. O pdf.js é injetado para não acoplar o ambiente.

import { detectarFormato, hashArquivo, ErroImportacao } from './detectar.js'
import { parseCsv, parseTabelaHtml, tabelaParaRegistros } from './tabela.js'
import { parseOfx } from './ofx.js'
import { lerXlsx, lerXls } from './planilha.js'
import { extrairLinhasPdf } from './pdf.js'
import { linhasTextoParaRegistros } from './texto.js'
import { reconhecerInstituicao } from './instituicoes.js'
import { interpretarRegistros } from './interpretar.js'
import { normalizarDescricao } from './normalizar.js'
import { MAXIMO_LINHAS, TIPOS_DOCUMENTO } from './limites.js'

export const ETAPAS = [
  { id: 'identificar', titulo: 'Identificando o documento' },
  { id: 'extrair', titulo: 'Extraindo os dados' },
  { id: 'instituicao', titulo: 'Reconhecendo a instituição' },
  { id: 'datas_valores', titulo: 'Identificando datas e valores' },
  { id: 'interpretar', titulo: 'Interpretando as descrições' },
  { id: 'classificar', titulo: 'Classificando as movimentações' },
  { id: 'duplicidades', titulo: 'Verificando duplicidades' },
  { id: 'previa', titulo: 'Preparando a prévia' },
]

function melhorTabela(folhas, referencia) {
  let melhor = null
  for (const f of folhas) {
    const t = tabelaParaRegistros(f.linhas, { referencia })
    if (t && (!melhor || t.registros.length > melhor.registros.length)) melhor = { ...t, linhas: f.linhas }
  }
  return melhor
}

function textoPistas(linhas) {
  return linhas.slice(0, 60).map(l => (Array.isArray(l) ? l.join(' ') : l.texto || '')).join(' ')
}

// Sinais de que o arquivo é de outro tipo (ex.: fatura enviada como extrato).
function avisoTipoTrocado(tipoDocumento, texto, tipoContaOfx) {
  const n = normalizarDescricao(texto)
  const pareceFatura = /\bFATURA\b/.test(n) && /\b(VENCIMENTO|LIMITE|FECHAMENTO)\b/.test(n)
  const pareceInvest = /\b(CUSTODIA|CORRETORA|AREA DO INVESTIDOR|POSICAO CONSOLIDADA|RENTABILIDADE)\b/.test(n)
  let sugerido = null
  if (tipoContaOfx === 'cartao') sugerido = 'fatura_cartao'
  else if (tipoContaOfx === 'investimento') sugerido = 'extrato_investimentos'
  else if (tipoContaOfx === 'banco') sugerido = 'extrato_bancario'
  else if (pareceFatura) sugerido = 'fatura_cartao'
  else if (pareceInvest) sugerido = 'extrato_investimentos'
  if (sugerido && sugerido !== tipoDocumento) {
    return `Este arquivo parece ser ${TIPOS_DOCUMENTO[sugerido].toLowerCase()}, mas foi enviado como ${TIPOS_DOCUMENTO[tipoDocumento].toLowerCase()}. Confira os lançamentos.`
  }
  return null
}

/**
 * @param {{ bytes: Uint8Array, nome: string, tipoDocumento: string, nomeTitular?: string, hoje: string }} entrada
 * @param {{ carregarPdfjs: () => Promise<object>, progresso?: (etapa: string) => void }} recursos
 */
export async function extrairDocumento(entrada, recursos) {
  const { bytes, nome, tipoDocumento, nomeTitular, hoje } = entrada
  const progresso = recursos.progresso || (() => {})
  if (!TIPOS_DOCUMENTO[tipoDocumento]) throw new ErroImportacao('tipo', 'Tipo de documento inválido.')

  progresso('identificar')
  const det = detectarFormato(bytes, nome)
  const arquivoHash = await hashArquivo(bytes)

  progresso('extrair')
  let registros = []
  let meta = {}
  let pistas = { codigos: [], texto: '' }
  let linhasLidas = 0
  let colunasInferidas = false
  let tipoContaOfx = null
  const avisos = []

  if (det.formato === 'ofx') {
    const ofx = parseOfx(det.texto)
    if (!ofx) throw new ErroImportacao('corrompido', 'O arquivo OFX está incompleto ou corrompido.')
    registros = ofx.registros
    meta = { periodo: ofx.periodo, saldoFinal: ofx.saldo, conta: ofx.conta }
    pistas = { codigos: [ofx.instituicao.bankId, ofx.instituicao.fid, ofx.instituicao.brokerId], texto: ofx.instituicao.org || '' }
    linhasLidas = registros.length
    tipoContaOfx = ofx.tipoConta
  } else if (det.formato === 'pdf') {
    const pdfjs = await recursos.carregarPdfjs()
    const pdf = await extrairLinhasPdf(bytes, pdfjs)
    const res = linhasTextoParaRegistros(pdf.linhas, { tipoDocumento, hoje })
    registros = res.registros
    meta = res.meta
    pistas.texto = textoPistas(pdf.linhas)
    linhasLidas = res.linhasLidas
    if (pdf.truncado) avisos.push(`O PDF tem ${pdf.paginasTotal} páginas; foram lidas as primeiras ${pdf.paginas}.`)
  } else {
    let tabela
    if (det.formato === 'csv') {
      const linhas = parseCsv(det.texto)
      tabela = melhorTabela([{ linhas }], hoje)
    } else if (det.htmlPlanilha) {
      tabela = melhorTabela([{ linhas: parseTabelaHtml(det.texto) }], hoje)
    } else if (det.formato === 'xlsx') {
      tabela = melhorTabela(await lerXlsx(bytes), hoje)
    } else {
      tabela = melhorTabela(lerXls(bytes), hoje)
    }
    if (!tabela) {
      throw new ErroImportacao('estrutura', 'Não reconhecemos as colunas do arquivo. Ele precisa ter ao menos data, descrição e valor.')
    }
    registros = tabela.registros
    colunasInferidas = tabela.inferido
    linhasLidas = tabela.linhas.length
    pistas.texto = textoPistas(tabela.linhas)
    if (colunasInferidas) avisos.push('O arquivo não tem cabeçalho reconhecível; as colunas foram deduzidas pelo conteúdo. Confira datas e valores.')
  }

  if (registros.length > MAXIMO_LINHAS) {
    avisos.push(`O arquivo tem mais de ${MAXIMO_LINHAS} lançamentos; apenas os primeiros ${MAXIMO_LINHAS} foram lidos.`)
    registros = registros.slice(0, MAXIMO_LINHAS)
  }
  if (registros.length === 0) {
    throw new ErroImportacao('sem_lancamentos', 'Nenhuma movimentação foi reconhecida neste arquivo. Verifique se é o documento correto.')
  }

  progresso('instituicao')
  const instituicao = reconhecerInstituicao(pistas)
  const trocado = avisoTipoTrocado(tipoDocumento, pistas.texto, tipoContaOfx)
  if (trocado) avisos.push(trocado)

  progresso('datas_valores')
  const semData = registros.filter(r => !r.data && !r.posicao).length
  const semValor = registros.filter(r => r.valor == null && r.valorAtual == null && !(r.quantidade != null && r.preco != null)).length
  if (semData) avisos.push(`${semData} linha(s) sem data reconhecida. Elas aparecem na prévia para correção.`)
  if (semValor) avisos.push(`${semValor} linha(s) sem valor reconhecido.`)

  progresso('interpretar')
  const itens = interpretarRegistros(registros, tipoDocumento, { nomeTitular })

  const datas = itens.map(i => i.data).filter(Boolean).sort()
  const periodo = {
    inicio: meta.periodo?.inicio || datas[0] || null,
    fim: meta.periodo?.fim || datas[datas.length - 1] || null,
  }

  return {
    nome,
    formato: det.formato,
    arquivoHash,
    tamanho: bytes.length,
    instituicao,
    meta,
    itens,
    avisos,
    linhasLidas,
    periodo,
    colunasInferidas,
  }
}
