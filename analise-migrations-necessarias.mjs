/**
 * ANÁLISE: Migrations Necessárias vs Schema Atual DEV
 */

console.log('═'.repeat(70))
console.log('ANÁLISE: Schema Esperado vs Schema DEV Atual')
console.log('═'.repeat(70))
console.log()

// Schema base (01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql)
const SCHEMA_BASE_PERFIS = [
  'id',
  'nome', 
  'email',
  'criado_em'
]

// 2026-10_admin_core.sql
const ADMIN_CORE_PERFIS = [
  'papel',
  'ativo',
  'ultimo_acesso',
  'onboarding_concluido'
]

// 2026-11_onboarding_perfil.sql
const ONBOARDING_PERFIL = [
  'objetivos_financeiros',
  'onboarding_etapa'
]

// 2026-11_perfis_saldo_base.sql (recém-criada)
const SALDO_BASE = [
  'saldo_base',
  'saldo_base_data'
]

// Schema ATUAL no DEV (confirmado por auditoria)
const SCHEMA_DEV_ATUAL = [
  'id',
  'nome',
  'email',
  'criado_em',
  'saldo_base',
  'saldo_base_data'
]

console.log('TABELA: perfis')
console.log()
console.log('Schema Base (mínimo):')
SCHEMA_BASE_PERFIS.forEach(col => console.log(`  ✅ ${col}`))
console.log()

console.log('DEV Atual:')
SCHEMA_DEV_ATUAL.forEach(col => {
  const naBase = SCHEMA_BASE_PERFIS.includes(col)
  const emoji = naBase ? '✅' : '➕'
  console.log(`  ${emoji} ${col}`)
})
console.log()

console.log('━━━ MIGRATIONS FALTANTES ━━━')
console.log()

// Admin Core
const faltaAdminCore = ADMIN_CORE_PERFIS.filter(col => !SCHEMA_DEV_ATUAL.includes(col))
if (faltaAdminCore.length > 0) {
  console.log('❌ 2026-10_admin_core.sql NÃO APLICADA')
  console.log('   Colunas faltantes:')
  faltaAdminCore.forEach(col => console.log(`     - ${col}`))
  console.log()
} else {
  console.log('✅ 2026-10_admin_core.sql aplicada')
  console.log()
}

// Onboarding Perfil
const faltaOnboarding = ONBOARDING_PERFIL.filter(col => !SCHEMA_DEV_ATUAL.includes(col))
if (faltaOnboarding.length > 0) {
  console.log('❌ 2026-11_onboarding_perfil.sql NÃO APLICADA')
  console.log('   Colunas faltantes:')
  faltaOnboarding.forEach(col => console.log(`     - ${col}`))
  console.log()
} else {
  console.log('✅ 2026-11_onboarding_perfil.sql aplicada')
  console.log()
}

// Saldo Base
const faltaSaldoBase = SALDO_BASE.filter(col => !SCHEMA_DEV_ATUAL.includes(col))
if (faltaSaldoBase.length > 0) {
  console.log('❌ 2026-11_perfis_saldo_base.sql NÃO APLICADA')
  console.log('   Colunas faltantes:')
  faltaSaldoBase.forEach(col => console.log(`     - ${col}`))
  console.log()
} else {
  console.log('✅ 2026-11_perfis_saldo_base.sql aplicada')
  console.log()
}

console.log('━━━ SCHEMA COMPLETO ESPERADO ━━━')
console.log()
const schemaCompleto = [
  ...SCHEMA_BASE_PERFIS,
  ...ADMIN_CORE_PERFIS,
  ...ONBOARDING_PERFIL,
  ...SALDO_BASE
]

schemaCompleto.forEach(col => {
  const presente = SCHEMA_DEV_ATUAL.includes(col)
  console.log(`  ${presente ? '✅' : '❌'} ${col}`)
})

console.log()
console.log('━━━ OUTRAS TABELAS (GRANT) ━━━')
console.log()
console.log('Auditoria detectou:')
console.log('  ⚠️  receitas: SEM PERMISSÃO')
console.log('  ⚠️  despesas: SEM PERMISSÃO')
console.log('  ⚠️  categorias: SEM PERMISSÃO')
console.log()
console.log('Ação necessária: GRANT SELECT, INSERT, UPDATE, DELETE')
console.log()

console.log('═'.repeat(70))
console.log('RESUMO')
console.log('═'.repeat(70))
console.log()
console.log('Migrations faltantes no DEV:')
console.log('  1. 2026-10_admin_core.sql (4 colunas)')
console.log('  2. 2026-11_onboarding_perfil.sql (2 colunas)')
console.log('  3. GRANT em receitas, despesas, categorias')
console.log()
console.log('Migration já aplicada:')
console.log('  ✅ 2026-11_perfis_saldo_base.sql')
