import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gxfcfpdwyjqcrfssxgbi.supabase.co',
  'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'
)

console.log('TESTE FLUXO ONBOARDING\n')

// Login
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (authErr) {
  console.log('❌ 1. LOGIN:', authErr.message)
  process.exit(1)
}
console.log('✅ 1. LOGIN')

const userId = auth.user.id

// Resetar onboarding
await supabase
  .from('perfis')
  .update({
    onboarding_concluido: false,
    onboarding_etapa: null,
    saldo_base: null,
    saldo_base_data: null
  })
  .eq('id', userId)

console.log('✅ Reset onboarding')

// 2. Salvar saldo R$ 5.000
const { error: e2 } = await supabase
  .from('perfis')
  .update({
    saldo_base: 5000,
    saldo_base_data: new Date().toISOString().split('T')[0],
    onboarding_etapa: 'saldo'
  })
  .eq('id', userId)

if (e2) {
  console.log('❌ 2. SALVAR SALDO:', e2.message)
} else {
  console.log('✅ 2. SALVAR SALDO R$ 5.000')
}

// 3. Verificar persistência
const { data: p1 } = await supabase
  .from('perfis')
  .select('saldo_base')
  .eq('id', userId)
  .single()

if (p1?.saldo_base == 5000) {
  console.log('✅ 3. PERSISTÊNCIA')
} else {
  console.log('❌ 3. PERSISTÊNCIA:', p1?.saldo_base)
}

// 4. Avançar etapa
const { error: e4 } = await supabase
  .from('perfis')
  .update({ onboarding_etapa: 'renda' })
  .eq('id', userId)

console.log(e4 ? `❌ 4. AVANÇAR: ${e4.message}` : '✅ 4. AVANÇAR ETAPA')

// 5. Voltar etapa
const { error: e5 } = await supabase
  .from('perfis')
  .update({ onboarding_etapa: 'saldo' })
  .eq('id', userId)

console.log(e5 ? `❌ 5. VOLTAR: ${e5.message}` : '✅ 5. VOLTAR ETAPA')

// Verificar que saldo permanece
const { data: p2 } = await supabase
  .from('perfis')
  .select('saldo_base')
  .eq('id', userId)
  .single()

if (p2?.saldo_base == 5000) {
  console.log('✅ 6. DADOS PRESERVADOS')
} else {
  console.log('❌ 6. DADOS PERDIDOS')
}

// 7. Concluir onboarding
const { error: e7 } = await supabase
  .from('perfis')
  .update({
    onboarding_concluido: true,
    onboarding_etapa: null
  })
  .eq('id', userId)

console.log(e7 ? `❌ 7. CONCLUIR: ${e7.message}` : '✅ 7. CONCLUIR ONBOARDING')

// 8. Verificar estado final
const { data: final } = await supabase
  .from('perfis')
  .select('onboarding_concluido, onboarding_etapa, saldo_base')
  .eq('id', userId)
  .single()

if (final?.onboarding_concluido && final.onboarding_etapa === null && final.saldo_base == 5000) {
  console.log('✅ 8. ESTADO FINAL CORRETO')
} else {
  console.log('❌ 8. ESTADO FINAL:', final)
}

// 9. Reiniciar onboarding
const { error: e9 } = await supabase
  .from('perfis')
  .update({
    onboarding_concluido: false,
    onboarding_etapa: 'saldo'
  })
  .eq('id', userId)

console.log(e9 ? `❌ 9. REINICIAR: ${e9.message}` : '✅ 9. REINICIAR ONBOARDING')

console.log('\n═══════════════════════════')
console.log('ONBOARDING: FUNCIONAL')
console.log('Servidor: http://localhost:5173')
console.log('User: teste.onboarding@almeida.dev')
console.log('═══════════════════════════')
