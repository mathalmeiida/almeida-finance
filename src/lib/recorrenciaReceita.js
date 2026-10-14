// ─── Recorrência de RECEITAS (funções PURAS, sem UI/banco) ────────────────────
// Espelha a lógica de recorrência de despesas, estendida com:
//   'quinzenal' (a cada 15 dias), 'personalizado' (intervalo em meses) e
//   término por nº de ocorrências ou por data (data_fim).
// Retrocompatível: receitas antigas só têm o booleano "recorrente".

export function frequenciaDaReceita(r) {
  if (r.frequencia) return r.frequencia
  if (r.recorrente) return r.recorrencia_meses != null ? 'por_meses' : 'mensal'
  return 'nao_repete'
}

function ocorrenciasSemanaisNoMes(ano, mes, diaSemana, diaInicialNoMes) {
  const ultimoDia = new Date(ano, mes, 0).getDate()
  let count = 0
  for (let dia = diaInicialNoMes; dia <= ultimoDia; dia++) {
    if (new Date(ano, mes - 1, dia).getDay() === diaSemana) count++
  }
  return count
}

function ocorrenciasQuinzenaisNoMes(inicio, ano, mes, dataFimISO) {
  const primeiroDoMes = new Date(ano, mes - 1, 1)
  const ultimoDoMes = new Date(ano, mes, 0)
  const fim = dataFimISO ? new Date(dataFimISO + 'T12:00:00') : null
  let count = 0
  const d = new Date(inicio)
  while (d <= ultimoDoMes) {
    if (d >= primeiroDoMes && (!fim || d <= fim)) count++
    d.setDate(d.getDate() + 14)
  }
  return count
}

function indiceMesDesde(inicio, ano, mes) {
  return (ano - inicio.getFullYear()) * 12 + ((mes - 1) - inicio.getMonth())
}

function contarSemanaisAteMes(inicio, ano, mes) {
  const ultimoDoMes = new Date(ano, mes, 0)
  let count = 0
  const d = new Date(inicio)
  while (d <= ultimoDoMes) { count++; d.setDate(d.getDate() + 7) }
  return count
}
function contarQuinzenaisAteMes(inicio, ano, mes, dataFimISO) {
  const ultimoDoMes = new Date(ano, mes, 0)
  const fim = dataFimISO ? new Date(dataFimISO + 'T12:00:00') : null
  let count = 0
  const d = new Date(inicio)
  while (d <= ultimoDoMes) {
    if (!fim || d <= fim) count++
    d.setDate(d.getDate() + 14)
  }
  return count
}

/**
 * Valor que uma receita representa em um mês/ano, conforme a frequência e o
 * término (ocorrencias ou data_fim). Pura; não grava nada.
 */
export function valorReceitaRecorrenteNoMes(r, ano, mes) {
  const freq = frequenciaDaReceita(r)
  if (freq === 'nao_repete') return 0

  const inicio = new Date(r.data + 'T12:00:00')
  if (isNaN(inicio)) return 0
  const valor = Number(r.valor) || 0
  const indiceMes = indiceMesDesde(inicio, ano, mes)
  if (indiceMes < 0) return 0 // antes da 1ª ocorrência

  // Término por DATA (todas as frequências): após data_fim, zera.
  const dataFim = r.data_fim || null
  if (dataFim) {
    const primeiroDoMes = `${ano}-${String(mes).padStart(2, '0')}-01`
    if (dataFim < primeiroDoMes) return 0
  }
  const ocorr = r.ocorrencias != null ? Number(r.ocorrencias) : null

  if (freq === 'semanal') {
    const ehPrimeiroMes = indiceMes === 0
    const diaInicial = ehPrimeiroMes ? inicio.getDate() : 1
    const n = ocorrenciasSemanaisNoMes(ano, mes, inicio.getDay(), diaInicial)
    if (ocorr != null) {
      const jaContadas = contarSemanaisAteMes(inicio, ano, mes)
      const restantes = Math.max(0, ocorr - (jaContadas - n))
      return valor * Math.min(n, restantes)
    }
    return valor * n
  }

  if (freq === 'quinzenal') {
    const n = ocorrenciasQuinzenaisNoMes(inicio, ano, mes, dataFim)
    if (ocorr != null) {
      const jaContadas = contarQuinzenaisAteMes(inicio, ano, mes, dataFim)
      const restantes = Math.max(0, ocorr - (jaContadas - n))
      return valor * Math.min(n, restantes)
    }
    return valor * n
  }

  // Mensais (mensal, por_meses, personalizado): 1 recebimento por período.
  const intervalo = (freq === 'por_meses' || freq === 'personalizado')
    ? Math.max(1, Number(r.recorrencia_meses) || 1)
    : 1
  if (indiceMes % intervalo !== 0) return 0
  const ordinal = indiceMes / intervalo
  if (ocorr != null && ordinal >= ocorr) return 0
  return valor
}

/** Indica se a receita tem valor neste mês (compat.). */
export function receitaRecorrenteAtivaNoMes(r, ano, mes) {
  return valorReceitaRecorrenteNoMes(r, ano, mes) > 0
}
