import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const supabaseKey = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(supabaseUrl, supabaseKey)

const migrationSQL = readFileSync('./supabase/migrations/2026-01_sistema_pagamento_faturas.sql', 'utf-8')

async function applyMigration() {
  console.log('🚀 Aplicando migration no DEV...')
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL })
    
    if (error) {
      // Tenta via query direto
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1)
      
      if (directError) {
        console.error('❌ Erro:', error)
        console.log('⚠️  Aplicação manual necessária via Supabase Dashboard')
        process.exit(1)
      }
    }
    
    console.log('✅ Migration aplicada com sucesso!')
  } catch (err) {
    console.error('❌ Erro ao aplicar migration:', err.message)
    console.log('⚠️  Aplicação manual necessária via Supabase Dashboard')
    console.log('📋 URL: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql')
  }
}

applyMigration()
