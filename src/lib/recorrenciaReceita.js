// Recorrência de receitas: funções puras, sem banco de dados ou interface.
// Datas no formato ISO local: YYYY-MM-DD. Meses de 1 a 12.

export function frequenciaDaReceita(receita) {
  if (receita.frequencia) return receita.frequencia
  if (receita.recorrente) return receita.recorrencia_meses != null ? 'por_meses' : 'mensal'
  return 'nao_repete'
}

function dataISO(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia, 12)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null
  return data
}

function adicionarDias(data, dias) {
  const proxima = new Date(data)
  proxima.setDate(proxima.getDate() + dias)
  return proxima
}

function diasSelecionados(receita) {
  if (!Array.isArray(receita.dias_do_mes)) return []
  return [...new Set(receita.dias_do_mes.map(Number))]
    .filter(dia => Number.isInteger(dia) && dia >= 1 && dia <= 31)
    .sort((a, b) => a - b)
}

// Conta apenas ocorrências reais, desde o início e até o término configurado.
// O limite de ocorrências se aplica à sequência inteira, não a cada mês.
export function valorReceitaRecorrenteNoMes(receita, ano, mes) {
  const frequencia = frequenciaDaReceita(receita)
  if (frequencia === 'nao_repete') return 0
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return 0

  const inicio = dataISO(receita.data)
  if (!inicio) return 0
  const fimConfigurado = receita.data_fim ? dataISO(receita.data_fim) : null
  if (receita.data_fim && !fimConfigurado) return 0
  const inicioMes = new Date(ano, mes - 1, 1, 12)
  const fimMes = new Date(ano, mes, 0, 12)
  if (fimMes < inicio || (fimConfigurado && fimConfigurado < inicioMes)) return 0

  const limite = receita.ocorrencias == null ? Infinity : Number(receita.ocorrencias)
  if (!(limite > 0)) return 0
  const fim = fimConfigurado && fimConfigurado < fimMes ? fimConfigurado : fimMes
  const valor = Number(receita.valor) || 0
  let total = 0
  let contadas = 0

  function registrar(data) {
    if (data < inicio || data > fim || contadas >= limite) return false
    contadas++
    if (data >= inicioMes) total++
    return contadas < limite
  }

  if (frequencia === 'dias_especificos') {
    const dias = diasSelecionados(receita)
    if (!dias.length) return 0
    let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1, 12)
    while (cursor <= fim && contadas < limite) {
      const diasNoMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      for (const dia of dias) {
        if (dia > diasNoMes) continue // Dia 31 não ocorre em meses menores.
        const data = new Date(cursor.getFullYear(), cursor.getMonth(), dia, 12)
        registrar(data)
        if (contadas >= limite) break
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12)
    }
    return total * valor
  }

  const passos = {
    semanal: 7,
    quinzenal: 14, // Preserva a regra anterior do projeto (a cada 14 dias).
    a_cada_10_dias: 10,
    a_cada_20_dias: 20
  }
  if (Object.prototype.hasOwnProperty.call(passos, frequencia)) {
    for (let data = new Date(inicio); data <= fim && contadas < limite; data = adicionarDias(data, passos[frequencia])) {
      registrar(data)
    }
    return total * valor
  }

  if (!['mensal', 'por_meses', 'personalizado'].includes(frequencia)) return 0
  const intervalo = frequencia === 'mensal' ? 1 : Math.max(1, Math.floor(Number(receita.recorrencia_meses) || 1))
  const diaOriginal = inicio.getDate()
  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1, 12)
  let indice = 0
  while (cursor <= fim && contadas < limite) {
    if (indice % intervalo === 0) {
      const ultimoDia = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      const data = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(diaOriginal, ultimoDia), 12)
      registrar(data)
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12)
    indice++
  }
  return total * valor
}

export function receitaRecorrenteAtivaNoMes(receita, ano, mes) {
  return valorReceitaRecorrenteNoMes(receita, ano, mes) > 0
}