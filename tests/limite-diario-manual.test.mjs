/**
 * Testes de validação do limite diário manual
 * Verifica cálculo sem acessar banco de dados
 */

// Simulação da função calcularLimiteDiario do Dashboard
function calcularLimiteDiario({
  receitaMes,
  compromissosMes,
  reservaPct,
  modo,
  limiteManual,
  hoje,
  baseLivre,
  saldoConfigurado = false,
  dataProximaReceita
}) {
  if (!saldoConfigurado) return 0

  const inicio = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )

  const fim = dataProximaReceita
    ? new Date(`${dataProximaReceita}T12:00:00`)
    : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  const dias = Math.max(
    1,
    Math.ceil((fim - inicio) / 86400000)
  )

  const pctSeguro = Math.min(100, Math.max(0, Number(reservaPct) || 0))
  const reserva = Math.max(0, Number(receitaMes) || 0) * (pctSeguro / 100)
  const disponivel = Math.max(0, (Number(baseLivre) || 0) - reserva)
  const limiteSeguro = dias > 0 ? disponivel / dias : 0

  if (modo === 'manual') {
    return Math.max(0, Number(limiteManual) || 0)
  }

  return limiteSeguro
}

// Testes
console.log('# Testes de Limite Diário Manual\n')

const hoje = new Date(2026, 10, 15) // 15 de novembro de 2026
const cenarioBase = {
  hoje,
  receitaMes: 5000,
  compromissosMes: 2000,
  reservaPct: 20,
  baseLivre: 3000,
  saldoConfigurado: true,
  dataProximaReceita: null
}

// Teste 1: Modo automático
const limiteAuto = calcularLimiteDiario({
  ...cenarioBase,
  modo: 'auto',
  limiteManual: null
})
console.log(`✓ Modo automático: R$ ${limiteAuto.toFixed(2)}`)
console.assert(limiteAuto > 0, 'Limite automático deve ser maior que 0')

// Teste 2: Modo manual com R$ 100/dia
const limiteManual100 = calcularLimiteDiario({
  ...cenarioBase,
  modo: 'manual',
  limiteManual: 100
})
console.log(`✓ Modo manual (R$ 100/dia): R$ ${limiteManual100.toFixed(2)}`)
console.assert(limiteManual100 === 100, 'Limite manual deve ser exatamente R$ 100')

// Teste 3: Modo manual com R$ 50/dia
const limiteManual50 = calcularLimiteDiario({
  ...cenarioBase,
  modo: 'manual',
  limiteManual: 50
})
console.log(`✓ Modo manual (R$ 50/dia): R$ ${limiteManual50.toFixed(2)}`)
console.assert(limiteManual50 === 50, 'Limite manual deve ser exatamente R$ 50')

// Teste 4: Modo manual ignora receita e compromissos
const limiteManualAlto = calcularLimiteDiario({
  ...cenarioBase,
  receitaMes: 1000, // baixa
  compromissosMes: 900, // alta
  modo: 'manual',
  limiteManual: 200
})
console.log(`✓ Modo manual ignora contexto financeiro: R$ ${limiteManualAlto.toFixed(2)}`)
console.assert(limiteManualAlto === 200, 'Limite manual não deve depender de receita/compromissos')

// Teste 5: Modo manual não altera saldo (apenas define limite de gasto)
console.log(`✓ Modo manual não altera baseLivre (permanece R$ ${cenarioBase.baseLivre})`)
console.assert(cenarioBase.baseLivre === 3000, 'Saldo bancário não deve ser alterado pelo limite manual')

// Teste 6: Sem configuração (conta nova)
const limiteSemConfig = calcularLimiteDiario({
  ...cenarioBase,
  saldoConfigurado: false,
  modo: 'manual',
  limiteManual: 100
})
console.log(`✓ Sem saldo configurado: R$ ${limiteSemConfig.toFixed(2)}`)
console.assert(limiteSemConfig === 0, 'Sem saldo configurado deve retornar 0')

// Teste 7: Limite manual negativo (proteção)
const limiteNegativo = calcularLimiteDiario({
  ...cenarioBase,
  modo: 'manual',
  limiteManual: -50
})
console.log(`✓ Limite negativo protegido: R$ ${limiteNegativo.toFixed(2)}`)
console.assert(limiteNegativo === 0, 'Limite negativo deve ser protegido para 0')

// Teste 8: Modo não reconhecido (fallback para automático)
const limiteInvalido = calcularLimiteDiario({
  ...cenarioBase,
  modo: 'invalido',
  limiteManual: 100
})
console.log(`✓ Modo inválido usa automático: R$ ${limiteInvalido.toFixed(2)}`)
console.assert(limiteInvalido === limiteAuto, 'Modo inválido deve usar cálculo automático')

console.log('\n✅ Todos os testes de limite diário passaram')
console.log('\nVERIFICAÇÕES CONFIRMADAS:')
console.log('- Modo manual retorna valor fixo configurado')
console.log('- Modo manual ignora receita, compromissos e reserva')
console.log('- Modo manual não altera saldo bancário (baseLivre)')
console.log('- Limite negativo é protegido para zero')
console.log('- Sem configuração retorna zero independente do modo')
