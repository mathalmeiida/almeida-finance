// Almeida Finance — fluxo de caixa diario para visualizacao.
// Nao modifica saldo, reserva, banco ou regras do orcamento.
import { valorDespesaRecorrenteNoMes, frequenciaDaDespesa } from '../hooks/useDespesas'
import { valorParcelaNoMes } from '../hooks/useParcelamentos'
import { totalFaturaComOverride, faturaInformadaNoMes } from './faturaCartao'
import { frequenciaDaReceita, valorReceitaRecorrenteNoMes } from './recorrenciaReceita'
import { labelMes, partesHojeBrasil } from './utils'
import { vencimentoEfetivo } from './calendarioBancario'

const ultimoDia = (ano, mes) => new Date(ano, mes, 0).getDate()
const diaDe = iso => Number(String(iso || '').slice(8, 10)) || 1
const mesDe = iso => Number(String(iso || '').slice(5, 7))
const anoDe = iso => Number(String(iso || '').slice(0, 4))
const emMes = (iso, ano, mes) => anoDe(iso) === ano && mesDe(iso) === mes
const dataLocal = iso => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null
  const data = new Date(anoDe(iso), mesDe(iso) - 1, diaDe(iso), 12)
  return data.getFullYear() === anoDe(iso) && data.getMonth() + 1 === mesDe(iso) && data.getDate() === diaDe(iso) ? data : null
}
const isoDe = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
const adicionarDias = (data, n) => {
  const proxima = new Date(data)
  proxima.setDate(proxima.getDate() + n)
  return proxima
}

// Datas das ocorrencias respeitam inicio, fim, limite e as frequencias
// da lib recorrenciaReceita. A soma e reconciliada com o calculo oficial.
function diasDeReceita(receita, ano, mes) {
  const freq = frequenciaDaReceita(receita)
  const inicio = dataLocal(receita.data)
  if (!inicio || freq === 'nao_repete') return []
  const fimConf = receita.data_fim ? dataLocal(receita.data_fim) : null
  if (receita.data_fim && !fimConf) return []
  const fimMes = new Date(ano, mes, 0, 12)
  if (inicio > fimMes) return []
  const fim = fimConf && fimConf < fimMes ? fimConf : fimMes
  const limite = receita.ocorrencias == null ? Infinity : Number(receita.ocorrencias)
  if (!(limite > 0)) return []
  let contadas = 0
  const dias = []
  const registrar = data => {
    if (data < inicio || data > fim || contadas >= limite) return
    contadas += 1
    if (data.getFullYear() === ano && data.getMonth() + 1 === mes) dias.push(data.getDate())
  }
  const passo = { semanal: 7, quinzenal: 14, a_cada_10_dias: 10, a_cada_20_dias: 20 }[freq]
  if (passo) {
    for (let data = new Date(inicio); data <= fim && contadas < limite; data = adicionarDias(data, passo)) registrar(data)
  } else if (freq === 'dias_especificos') {
    const selecionados = Array.isArray(receita.dias_do_mes)
      ? [...new Set(receita.dias_do_mes.map(Number))].filter(d => Number.isInteger(d) && d >= 1 && d <= 31).sort((a, b) => a - b)
      : []
    for (let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1, 12); cursor <= fim && contadas < limite; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12)) {
      const max = ultimoDia(cursor.getFullYear(), cursor.getMonth() + 1)
      for (const d of selecionados) {
        if (d <= max) registrar(new Date(cursor.getFullYear(), cursor.getMonth(), d, 12))
        if (contadas >= limite) break
      }
    }
  } else if (['mensal', 'por_meses', 'personalizado'].includes(freq)) {
    const intervalo = freq === 'mensal' ? 1 : Math.max(1, Math.floor(Number(receita.recorrencia_meses) || 1))
    let indice = 0
    for (let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1, 12); cursor <= fim && contadas < limite; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12), indice++) {
      if (indice % intervalo === 0) {
        registrar(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(inicio.getDate(), ultimoDia(cursor.getFullYear(), cursor.getMonth() + 1)), 12))
      }
    }
  }
  return dias
}

export function gerarHorizonte({
  receitas = [], despesas = [], recorrentes = [], parcelamentos = [],
  cartoes = [], comprasCartao = [], faturasInformadas = [],
  saldoInicial = 0, reservaPct = 20, dataReferencia, meses = 12,
}) {
  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(dataReferencia || '') ? dataReferencia : null
  const hoje = referencia
    ? { ano: anoDe(referencia), mes: mesDe(referencia), dia: diaDe(referencia) }
    : partesHojeBrasil()
  const resultado = []
  let saldoAnterior = Number(saldoInicial) || 0
  const qtdMeses = Math.max(0, Math.min(120, Math.floor(Number(meses) || 0)))

  for (let i = 0; i < qtdMeses; i++) {
    const ref = new Date(hoje.ano, hoje.mes - 1 + i, 1)
    const ano = ref.getFullYear(), mes = ref.getMonth() + 1
    const ehMesAtual = i === 0
    const diasNoMes = ultimoDia(ano, mes)
    const porDia = Array.from({ length: diasNoMes + 1 }, () => ({ entradas: 0, saidas: 0, eventos: [] }))
    const adicionar = (dia, valor, tipo, descricao, categoria) => {
      const n = Number(valor)
      if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(Number(dia))) return
      const d = Math.max(1, Math.min(diasNoMes, Math.floor(Number(dia))))
      // Saldo informado ja representa as movimentacoes realizadas ate hoje.
      if (ehMesAtual && d <= hoje.dia) return
      const ev = porDia[d]
      if (tipo === 'entrada') ev.entradas += n
      else ev.saidas += n
      ev.eventos.push({ tipo, descricao: descricao || (tipo === 'entrada' ? 'Receita' : 'Despesa'), valor: n, categoria })
    }

    // A lista receitas deve conter TODOS os lancamentos (inclusive futuros).
    // Recorrentes sao calculados uma vez por cadastro, nao por mes carregado.
    const idsReceitas = new Set()
    for (const r of receitas) {
      if (!r || (r.id != null && idsReceitas.has(r.id))) continue
      if (r.id != null) idsReceitas.add(r.id)
      const valor = Number(r.valor) || 0
      if (valor <= 0) continue
      if (frequenciaDaReceita(r) !== 'nao_repete') {
        const valorMes = valorReceitaRecorrenteNoMes(r, ano, mes)
        const dias = diasDeReceita(r, ano, mes)
        if (!dias.length || valorMes <= 0) continue
        // Acerta possiveis diferencas de centavos na ultima ocorrencia.
        const valorPorOcorrencia = valorMes / dias.length
        dias.forEach((d, index) => adicionar(d,
          index === dias.length - 1 ? valorMes - valorPorOcorrencia * (dias.length - 1) : valorPorOcorrencia,
          'entrada', r.descricao || r.nome || 'Receita recorrente', 'receita'))
      } else if (emMes(r.data, ano, mes)) {
        adicionar(diaDe(r.data), valor, 'entrada', r.descricao || r.nome || 'Receita', 'receita')
      }
    }

    const idsDespesas = new Set()
    for (const d of despesas) {
      if (!d || (d.id != null && idsDespesas.has(d.id))) continue
      if (d.id != null) idsDespesas.add(d.id)
      if (d.recorrente || (d.frequencia && d.frequencia !== 'nao_repete')) continue
      if (d.pago_em || !emMes(d.data, ano, mes)) continue
      adicionar(diaDe(d.data), d.valor, 'saida', d.descricao, d.tipo_despesa === 'fixa' ? 'fixa' : 'variavel')
    }
    for (const d of recorrentes) {
      const valorMes = valorDespesaRecorrenteNoMes(d, ano, mes)
      if (valorMes <= 0 || d.pago_em) continue
      const freq = frequenciaDaDespesa(d)
      const dia = (freq === 'mensal' || freq === 'por_meses') ? diaDe(d.data) : 1
      adicionar(dia, valorMes, 'saida', d.descricao, d.tipo_despesa === 'fixa' ? 'fixa' : 'variavel')
    }

    for (const p of parcelamentos) {
      if (p.cartao_id || p.quitado_em) continue
      const valor = valorParcelaNoMes(p, ano, mes)
      if (valor > 0) adicionar(diaDe(p.primeira_parcela), valor, 'saida', p.descricao || 'Parcela', 'parcela')
    }

    // Examina tambem o vencimento nominal do mes anterior: se o banco
    // prorrogar para o mes atual, o valor entra na data real, nao no dia 30/31.
    for (const c of cartoes) {
      const compras = comprasCartao.filter(cp => cp.cartao_id === c.id)
      const parcelas = parcelamentos.filter(p => p.cartao_id === c.id)
      const diaFech = Number(c.dia_fechamento) || 1
      const diaVenc = Number(c.dia_vencimento) || 1
      for (const deslocamento of [-1, 0]) {
        const base = new Date(ano, mes - 1 + deslocamento, 1)
        const vencAno = base.getFullYear(), vencMes = base.getMonth() + 1
        let competencia = new Date(vencAno, vencMes - 1, 1)
        if (diaVenc < diaFech) competencia = new Date(vencAno, vencMes - 2, 1)
        const compAno = competencia.getFullYear(), compMes = competencia.getMonth() + 1
        const informada = faturaInformadaNoMes(faturasInformadas, c.id, compAno, compMes)
        const total = totalFaturaComOverride(compras, parcelas, faturasInformadas, c.id, c.dia_fechamento, compAno, compMes)
        const diaNominal = Number(informada?.vencimento_dia) || diaVenc
        const efetivo = vencimentoEfetivo(vencAno, vencMes, diaNominal)
        if (informada?.pago === true) continue
        if (!(total > 0)) continue
        if (efetivo.ano === ano && efetivo.mes === mes) {
          adicionar(efetivo.dia, total, 'saida', `Fatura ${c.nome || 'cartao'}`, 'cartao')
        }
      }
    }

    let entradasMes = 0, saidasMes = 0, saldo = saldoAnterior
    const dias = []
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const ev = porDia[dia]
      saldo += ev.entradas - ev.saidas
      entradasMes += ev.entradas
      saidasMes += ev.saidas
      dias.push({ dia, entradas: ev.entradas, saidas: ev.saidas, saldo,
        temEvento: ev.eventos.length > 0, eventos: ev.eventos,
        ehHoje: ehMesAtual && dia === hoje.dia })
    }
    const reserva = entradasMes > 0 ? entradasMes * (Math.min(100, Math.max(0, Number(reservaPct) || 0)) / 100) : 0
    resultado.push({ ano, mes, label: labelMes(new Date(ano, mes - 1, 1)), ehMesAtual,
      saldoInicial: saldoAnterior, entradas: entradasMes, saidas: saidasMes,
      reserva, saldoFinal: saldo, dias })
    saldoAnterior = saldo
  }
return resultado
}