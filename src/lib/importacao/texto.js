// ─── Interpretação de linhas de texto (PDF com texto selecionável) ──────────
// Reconhece lançamentos no formato "DATA  DESCRIÇÃO  VALOR [SALDO]" e os
// metadados do documento (vencimento, fechamento, total da fatura, período e
// saldo). Nada é inventado: linhas que não seguem o padrão são ignoradas e o
// usuário vê quantas linhas foram reconhecidas.

import { parseData, parseValor, removerAcentos, normalizarDescricao, arred2 } from './normalizar.js'

const RE_DATA_INICIO = /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s?(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\.?(?:\s?\d{4})?)(?=\s|$)\s*(.*)$/i
const RE_DATA_COMPLETA = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/
const RE_MOEDA = /(?:^|\s)(\(?-?\s?(?:R\$\s?)?-?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[-DC](?![A-Za-z]))?)(?=\s|$)/g

function moedas(texto) {
  const lista = []
  let m
  RE_MOEDA.lastIndex = 0
  while ((m = RE_MOEDA.exec(texto))) {
    const valor = parseValor(m[1])
    if (valor != null) lista.push({ valor, indice: m.index + (m[0].length - m[1].length), bruto: m[1] })
  }
  return lista
}

const PALAVRAS_DEBITO = /\b(PIX ENVIADO|PIX EMITIDO|ENVIADO|PAGAMENTO|PAGTO|PGTO|PAG |COMPRA|TARIFA|SAQUE|DEBITO|DEB |TRANSF(?:ERENCIA)? ENVIADA|TED ENVIADA|APLICACAO|BOLETO|IOF|JUROS COBRADOS|ANUIDADE)/
const PALAVRAS_CREDITO = /\b(RECEBIDO|RECEBIDA|SALARIO|CREDITO|DEPOSITO|RENDIMENTO|ESTORNO|RESGATE|DEVOLUCAO|REEMBOLSO|PROVENTOS|DIVIDENDO|TRANSF(?:ERENCIA)? RECEBIDA|TED RECEBIDA)/

function sinalPorPalavras(descricao) {
  const n = normalizarDescricao(descricao)
  const deb = PALAVRAS_DEBITO.test(n)
  const cred = PALAVRAS_CREDITO.test(n)
  if (deb && !cred) return -1
  if (cred && !deb) return 1
  return 0
}

const RE_IGNORAR = /^(SALDO|S A L D O|TOTAL|SUBTOTAL|LANCAMENTOS|DATA\s+(DESCRICAO|HISTORICO|LANCAMENTO))/

function extrairMetadados(linhas) {
  const meta = { vencimento: null, fechamento: null, totalFatura: null, periodo: null, saldoFinal: null, saldoAnterior: null }
  let ultimaDataCompleta = null
  for (const l of linhas) {
    const t = removerAcentos(l.texto).toUpperCase()
    const dataCompleta = t.match(RE_DATA_COMPLETA)
    if (dataCompleta) {
      const iso = parseData(dataCompleta[1])
      if (iso && (!ultimaDataCompleta || iso > ultimaDataCompleta)) ultimaDataCompleta = iso
    }
    const valores = moedas(l.texto)
    if (!meta.vencimento && /VENCIMENTO|VENCE EM/.test(t) && dataCompleta) meta.vencimento = parseData(dataCompleta[1])
    if (!meta.fechamento && /FECHAMENTO|FECHADA EM|DATA DE CORTE/.test(t) && dataCompleta) meta.fechamento = parseData(dataCompleta[1])
    if (meta.totalFatura == null && /TOTAL (DA|DESTA) FATURA|VALOR TOTAL DA FATURA|TOTAL A PAGAR|VALOR DA FATURA/.test(t) && valores.length) {
      meta.totalFatura = Math.abs(valores[valores.length - 1].valor)
    }
    const per = t.match(/(?:PERIODO|DE)\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s*(?:A|ATE|-)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/)
    if (!meta.periodo && per) meta.periodo = { inicio: parseData(per[1]), fim: parseData(per[2]) }
    if (/SALDO ANTERIOR/.test(t) && valores.length && meta.saldoAnterior == null) meta.saldoAnterior = valores[valores.length - 1].valor
    if (/SALDO (FINAL|DISPONIVEL|ATUAL|EM \d)/.test(t) && valores.length) {
      meta.saldoFinal = { valor: valores[valores.length - 1].valor, data: dataCompleta ? parseData(dataCompleta[1]) : null }
    }
  }
  meta.referencia = meta.vencimento || meta.periodo?.fim || ultimaDataCompleta
  return meta
}

/**
 * @param {{texto:string, celulas:string[], pagina:number}[]} linhas
 * @param {{ tipoDocumento: string, hoje?: string }} opcoes
 */
export function linhasTextoParaRegistros(linhas, opcoes = {}) {
  const meta = extrairMetadados(linhas)
  const referencia = meta.referencia || opcoes.hoje
  const registros = []
  let reconhecidas = 0

  for (let i = 0; i < linhas.length; i++) {
    const texto = linhas[i].texto.replace(/\s+/g, ' ').trim()
    const m = texto.match(RE_DATA_INICIO)
    if (!m) continue
    const data = parseData(m[1], { referencia })
    if (!data) continue
    let resto = m[2]
    // Segunda data (ex.: data da compra + data de lançamento) é descartada.
    // Em faturas, "03/10" logo após a data costuma ser a PARCELA, então só
    // descartamos quando é uma data completa (com ano).
    const segunda = resto.match(RE_DATA_INICIO)
    const segundaEhData = segunda && parseData(segunda[1], { referencia }) &&
      (opcoes.tipoDocumento !== 'fatura_cartao' || /\d{4}$/.test(segunda[1]))
    if (segundaEhData) resto = segunda[2]

    const valores = moedas(resto)
    if (valores.length === 0) continue
    const descricao = resto.slice(0, valores[0].indice).trim().replace(/\s*R\$\s*$/, '')
    if (!descricao || RE_IGNORAR.test(normalizarDescricao(descricao))) continue

    const valorBruto = valores[0]
    const saldo = valores.length > 1 ? valores[valores.length - 1].valor : null
    const temSinal = /-|\(|D$/.test(valorBruto.bruto.trim()) || /\bC$/.test(valorBruto.bruto.trim())
    reconhecidas++
    registros.push({
      linha: i + 1,
      pagina: linhas[i].pagina,
      data,
      dataTexto: m[1],
      descricao,
      valor: valorBruto.valor,
      saldo,
      temSinal,
      moedaEstrangeira: /US\$|USD|DOLAR|EUR\b/.test(removerAcentos(resto).toUpperCase()),
    })
  }

  // Sentido (entrada/saída) em extratos sem sinal: 1º pelo saldo corrido,
  // 2º por palavras-chave. Sem evidência, o item fica pendente de conferência.
  if (opcoes.tipoDocumento === 'extrato_bancario') {
    for (let k = 0; k < registros.length; k++) {
      const r = registros[k]
      if (r.temSinal && r.valor < 0) continue
      const anterior = registros[k - 1]
      const saldoAnterior = anterior?.saldo ?? (k === 0 ? meta.saldoAnterior : null)
      if (r.saldo != null && saldoAnterior != null) {
        const delta = arred2(r.saldo - saldoAnterior)
        if (Math.abs(Math.abs(delta) - Math.abs(r.valor)) < 0.011) {
          r.valor = delta < 0 ? -Math.abs(r.valor) : Math.abs(r.valor)
          r.sinalConfirmado = true
          continue
        }
      }
      if (!r.temSinal) {
        const s = sinalPorPalavras(r.descricao)
        if (s !== 0) r.valor = s * Math.abs(r.valor)
        else r.sinalIncerto = true
      }
    }
  }

  // Posições sem data (extratos de investimentos em PDF): "PETR4 100 38,50 3.850,00"
  const posicoes = []
  if (opcoes.tipoDocumento === 'extrato_investimentos') {
    for (let i = 0; i < linhas.length; i++) {
      const texto = linhas[i].texto.replace(/\s+/g, ' ').trim()
      if (RE_DATA_INICIO.test(texto)) continue
      const n = removerAcentos(texto).toUpperCase()
      const ticker = n.match(/\b([A-Z]{4}\d{1,2}[BF]?)\b/)
      const produto = n.match(/\b(TESOURO (SELIC|IPCA\+?|PREFIXADO|RENDA\+|EDUCA\+)[A-Z0-9 +]*?|CDB [A-Z0-9 ]+|LCI [A-Z0-9 ]+|LCA [A-Z0-9 ]+)(?=\s+\d|$)/)
      if (!ticker && !produto) continue
      const valores = moedas(texto)
      if (valores.length === 0) continue
      const qtd = texto.match(/(?:^|\s)(\d{1,3}(?:\.\d{3})*|\d+)(?=\s)(?![,.]\d)/g)
      posicoes.push({
        linha: i + 1,
        data: meta.periodo?.fim || meta.referencia || null,
        descricao: texto.slice(0, valores[0].indice).trim(),
        ativo: ticker ? ticker[1] : produto[1].trim(),
        valorAtual: Math.abs(valores[valores.length - 1].valor),
        preco: valores.length > 1 ? Math.abs(valores[0].valor) : null,
        quantidade: ticker && qtd ? Number(qtd[qtd.length - 1].trim().replace(/\./g, '')) || null : null,
        posicao: true,
      })
    }
  }

  return { registros: [...registros, ...posicoes], meta, linhasLidas: linhas.length, reconhecidas }
}
