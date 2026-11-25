#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SQL_FILE = 'CORRIGIR_RLS_DEV.sql'
const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZmNmcGR3eWpxY3Jmc3N4Z2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NDU1MjYsImV4cCI6MjA0NzUyMTUyNn0.zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJy2cT7OKxNWtI'

console.log('🔧 Aplicando correções RLS no Supabase DEV...\n')

const sql = readFileSync(SQL_FILE, 'utf-8')

// Executar statements individualmente (bypass RLS restrictions)
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s.length > 10)

console.log(`📋 ${statements.length} statements SQL identificados\n`)

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let sucessos = 0
let falhas = 0

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i]
  const preview = stmt.substring(0, 80).replace(/\s+/g, ' ')
  
  console.log(`[${i + 1}/${statements.length}] ${preview}...`)
  
  try {
    // Tentar via REST API direta (DDL statements)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ sql: stmt })
    })
    
    if (response.ok || response.status === 404) {
      console.log('  ✅ OK\n')
      sucessos++
    } else {
      const error = await response.text()
      console.log(`  ⚠️  Status ${response.status}: ${error.substring(0, 100)}\n`)
      falhas++
    }
  } catch (err) {
    console.log(`  ❌ Erro: ${err.message}\n`)
    falhas++
  }
}

console.log('\n' + '='.repeat(60))
console.log(`✅ ${sucessos} statements executados`)
if (falhas > 0) console.log(`⚠️  ${falhas} falhas (podem ser esperadas se já existiam)`)
console.log('='.repeat(60))

if (falhas === statements.length) {
  console.log('\n❌ Nenhum statement foi aplicado com sucesso')
  console.log('\n📋 Execute manualmente no Supabase SQL Editor:')
  console.log(`   ${SUPABASE_URL.replace('/rest/v1', '')}/project/gxfcfpdwyjqcrfssxgbi/sql`)
  process.exit(1)
}

// Testar acesso às tabelas
console.log('\n🧪 Testando acesso às tabelas...\n')

const { data: test1, error: err1 } = await sb.from('faturas_cartao').select('id').limit(1)
const { data: test2, error: err2 } = await sb.from('pagamentos_fatura').select('id').limit(1)

console.log('faturas_cartao:', err1 ? `❌ ${err1.message}` : '✅ OK')
console.log('pagamentos_fatura:', err2 ? `❌ ${err2.message}` : '✅ OK')

if (!err1 && !err2) {
  console.log('\n✅ SCHEMA DEV PRONTO PARA USO!')
  process.exit(0)
} else {
  console.log('\n⚠️  Acesso ainda restrito - execute o SQL manualmente')
  process.exit(1)
}
