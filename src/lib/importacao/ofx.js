// ─── Leitor de OFX (SGML 1.x e XML 2.x) ─────────────────────────────────────
// Processamento determinístico: datas, valores e identificadores (FITID) vêm
// direto das tags. Suporta extrato bancário (BANKMSGSRSV1), cartão
// (CREDITCARDMSGSRSV1) e investimentos (INVSTMTMSGSRSV1, básico).

import { parseData, parseValor, parseQuantidade } from './normalizar.js'
import { MAXIMO_LINHAS } from './limites.js'

// Lê o valor de uma tag em um trecho (funciona com e sem tag de fechamento).
function tag(bloco, nome) {
  const re = new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i')
  const m = bloco.match(re)
  return m ? m[1].trim() : null
}

function blocos(texto, nome) {
  const lista = []
  const re = new RegExp(`<${nome}>([\\s\\S]*?)(?=<\\/${nome}>|<${nome}>|<\\/BANKTRANLIST>|<\\/INVTRANLIST>|$)`, 'gi')
  let m
  while ((m = re.exec(texto)) && lista.length <= MAXIMO_LINHAS) {
    lista.push(m[1])
    if (m[0].length === 0) re.lastIndex++
  }
  return lista
}

function decodificar(t) {
  return t == null ? null : t.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
}

export function parseOfx(texto) {
  if (!/<OFX>/i.test(texto)) return null
  const corpo = texto.slice(texto.search(/<OFX>/i))

  const ehCartao = /<CREDITCARDMSGSRSV1>/i.test(corpo)
  const ehInvestimento = /<INVSTMTMSGSRSV1>/i.test(corpo)

  const org = decodificar(tag(corpo, 'ORG'))
  const fid = tag(corpo, 'FID')
  const bankId = tag(corpo, 'BANKID')
  const brokerId = tag(corpo, 'BROKERID')
  const conta = tag(corpo, 'ACCTID')
  const inicio = parseData(tag(corpo, 'DTSTART'))
  const fim = parseData(tag(corpo, 'DTEND'))

  const ledger = corpo.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|$)/i)
  const saldo = ledger
    ? { valor: parseValor(tag(ledger[1], 'BALAMT')), data: parseData(tag(ledger[1], 'DTASOF')) }
    : null

  const registros = []
  if (!ehInvestimento) {
    blocos(corpo, 'STMTTRN').forEach((b, i) => {
      registros.push({
        linha: i + 1,
        data: parseData(tag(b, 'DTPOSTED')),
        dataTexto: tag(b, 'DTPOSTED'),
        descricao: decodificar([tag(b, 'NAME'), tag(b, 'MEMO')].filter(Boolean)
          .filter((v, k, arr) => arr.indexOf(v) === k).join(' - ')),
        tipoMov: tag(b, 'TRNTYPE'),
        valor: parseValor(tag(b, 'TRNAMT')),
        idExterno: tag(b, 'FITID'),
      })
    })
  } else {
    // Investimentos: compras/vendas de títulos, rendimentos e transações em caixa.
    const secinfo = {}
    blocos(corpo, 'SECINFO').forEach(b => {
      const id = tag(b, 'UNIQUEID')
      if (id) secinfo[id] = { nome: decodificar(tag(b, 'SECNAME')), ticker: tag(b, 'TICKER') }
    })
    const tiposTransacao = ['BUYSTOCK', 'SELLSTOCK', 'BUYMF', 'SELLMF', 'BUYDEBT', 'SELLDEBT', 'BUYOTHER', 'SELLOTHER', 'INCOME', 'REINVEST']
    let n = 0
    for (const tipo of tiposTransacao) {
      blocos(corpo, tipo).forEach(b => {
        const sec = secinfo[tag(b, 'UNIQUEID')] || {}
        const total = parseValor(tag(b, 'TOTAL'))
        registros.push({
          linha: ++n,
          data: parseData(tag(b, 'DTTRADE') || tag(b, 'DTSETTLE')),
          descricao: decodificar(tag(b, 'MEMO')) || sec.nome || '',
          tipoMov: tipo === 'INCOME' ? (tag(b, 'INCOMETYPE') || 'INCOME') : tipo,
          valor: total,
          idExterno: tag(b, 'FITID'),
          ativo: sec.ticker || sec.nome || '',
          quantidade: parseQuantidade(tag(b, 'UNITS')),
          preco: parseValor(tag(b, 'UNITPRICE')),
        })
      })
    }
    blocos(corpo, 'INVBANKTRAN').forEach(b => {
      registros.push({
        linha: ++n,
        data: parseData(tag(b, 'DTPOSTED')),
        descricao: decodificar([tag(b, 'NAME'), tag(b, 'MEMO')].filter(Boolean).join(' - ')),
        tipoMov: tag(b, 'TRNTYPE'),
        valor: parseValor(tag(b, 'TRNAMT')),
        idExterno: tag(b, 'FITID'),
      })
    })
    // Posições (saldo patrimonial na data do demonstrativo)
    for (const tipo of ['POSSTOCK', 'POSMF', 'POSDEBT', 'POSOTHER']) {
      blocos(corpo, tipo).forEach(b => {
        const sec = secinfo[tag(b, 'UNIQUEID')] || {}
        registros.push({
          linha: ++n,
          data: parseData(tag(b, 'DTPRICEASOF')),
          descricao: sec.nome || '',
          tipoMov: 'POSICAO',
          ativo: sec.ticker || sec.nome || '',
          quantidade: parseQuantidade(tag(b, 'UNITS')),
          preco: parseValor(tag(b, 'UNITPRICE')),
          valorAtual: parseValor(tag(b, 'MKTVAL')),
          posicao: true,
        })
      })
    }
  }

  return {
    tipoConta: ehInvestimento ? 'investimento' : ehCartao ? 'cartao' : 'banco',
    instituicao: { org, fid, bankId, brokerId },
    conta: conta ? `•••${conta.slice(-4)}` : null,
    periodo: { inicio, fim },
    saldo,
    registros,
  }
}
