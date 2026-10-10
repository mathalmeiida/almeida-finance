// ─── Calendário bancário brasileiro ──────────────────────────────────────────
// Função PURA, 100% offline (sem API, sem dependências). Determina feriados
// NACIONAIS do Brasil (fixos + móveis derivados da Páscoa) e fins de semana,
// para prorrogar o VENCIMENTO de faturas quando cair em dia não útil.
//
// Escopo desta versão:
//   • Feriados NACIONAIS fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11,
//     15/11, 25/12.
//   • Feriados MÓVEIS (bancários): Sexta-feira Santa, Corpus Christi. Carnaval
//     (seg/ter) os bancos tratam como ponto facultativo; para o cálculo de
//     VENCIMENTO, a prática dominante é prorrogar — incluímos terça de Carnaval
//     e quarta-feira de cinzas (meio-expediente) de forma conservadora? NÃO:
//     mantemos apenas os feriados BANCÁRIOS consolidados (Sexta Santa e Corpus
//     Christi) + nacionais, evitando prorrogações indevidas. Carnaval fica como
//     observação (ver CARNAVAL_COMO_FERIADO).
//   • Fins de semana (sábado/domingo).
//
// Feriados ESTADUAIS/MUNICIPAIS NÃO são tratados aqui: dependeriam de uma base
// por localidade e de um campo de localidade no cadastro do cartão (não existe).
// Fica como extensão futura (exigiria migração). Documentado de propósito.
//
// Datas são tratadas como ano/mês/dia (sem horas), evitando qualquer
// deslocamento de fuso — coerente com o resto do app (fuso de Brasília).

// Carnaval (segunda e terça) é ponto facultativo bancário, não feriado nacional
// obrigatório. Para o cálculo de prorrogação de VENCIMENTO deixamos FALSE por
// padrão (não prorroga por Carnaval), que é o comportamento mais seguro para
// não "empurrar" vencimentos indevidamente. Pode ser ligado no futuro.
const CARNAVAL_COMO_FERIADO = false

// Domingo de Páscoa pelo algoritmo de Gauss/Meeus (Computus). Retorna {mes,dia}.
function domingoDePascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31) // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return { mes, dia }
}

// Soma "dias" a uma data (ano,mes,dia) e devolve 'YYYY-MM-DD'.
function somarDias(ano, mes, dia, delta) {
  const d = new Date(ano, mes - 1, dia + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const chaveMD = (mes, dia) => `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// Cache por ano (os feriados de um ano não mudam).
const _cacheFeriados = new Map()

// Conjunto de feriados NACIONAIS/bancários do ano, como 'YYYY-MM-DD'.
export function feriadosNacionais(ano) {
  if (_cacheFeriados.has(ano)) return _cacheFeriados.get(ano)
  const set = new Set()
  // Fixos (nacionais).
  const fixos = [
    [1, 1],   // Confraternização Universal
    [4, 21],  // Tiradentes
    [5, 1],   // Dia do Trabalho
    [9, 7],   // Independência
    [10, 12], // N. Sra. Aparecida
    [11, 2],  // Finados
    [11, 15], // Proclamação da República
    [12, 25], // Natal
  ]
  for (const [m, d] of fixos) set.add(`${ano}-${chaveMD(m, d)}`)

  // Móveis (derivados da Páscoa).
  const { mes: pm, dia: pd } = domingoDePascoa(ano)
  // Sexta-feira Santa = Páscoa − 2 dias (feriado nacional).
  set.add(somarDias(ano, pm, pd, -2))
  // Corpus Christi = Páscoa + 60 dias (feriado bancário).
  set.add(somarDias(ano, pm, pd, 60))
  if (CARNAVAL_COMO_FERIADO) {
    // Terça de Carnaval = Páscoa − 47 dias; segunda = −48.
    set.add(somarDias(ano, pm, pd, -47))
    set.add(somarDias(ano, pm, pd, -48))
  }

  _cacheFeriados.set(ano, set)
  return set
}

// É dia útil bancário? (não é fim de semana nem feriado nacional)
export function ehDiaUtil(ano, mes, dia) {
  const d = new Date(ano, mes - 1, dia)
  const dow = d.getDay() // 0=domingo, 6=sábado
  if (dow === 0 || dow === 6) return false
  const iso = `${ano}-${chaveMD(mes, dia)}`
  return !feriadosNacionais(ano).has(iso)
}

// Próximo dia útil >= a data informada. Retorna { ano, mes, dia }.
// Regra de VENCIMENTO: se cair em fim de semana/feriado, PRORROGA para o
// próximo dia útil (prática dominante dos bancos no Brasil).
export function proximoDiaUtil(ano, mes, dia) {
  let d = new Date(ano, mes - 1, dia)
  // Limite de segurança para não girar infinito (no máx. ~10 passos).
  for (let i = 0; i < 15; i++) {
    const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate()
    if (ehDiaUtil(y, m, dd)) return { ano: y, mes: m, dia: dd }
    d = new Date(y, m - 1, dd + 1)
  }
  // Fallback (não deve ocorrer): devolve a própria data.
  return { ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() }
}

// Dado o DIA de vencimento nominal e o mês/ano de competência de pagamento,
// devolve o DIA EFETIVO (prorrogado para o próximo dia útil) dentro do mesmo
// mês quando possível; se a prorrogação passar para o mês seguinte, ainda assim
// devolve a data real (o chamador decide como usar). Uso principal: ajustar o
// dia em que a fatura efetivamente sai do caixa.
export function vencimentoEfetivo(ano, mes, diaNominal) {
  const ultimo = new Date(ano, mes, 0).getDate()
  const diaBase = Math.min(Math.max(1, diaNominal), ultimo)
  return proximoDiaUtil(ano, mes, diaBase)
}
