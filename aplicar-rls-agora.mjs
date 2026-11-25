import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const sql = readFileSync('CORRIGIR_RLS_DEV.sql', 'utf-8')

// Usar anon key para executar (service_role não é necessário para DDL se temos acesso admin via dashboard)
const sb = createClient(
  'https://gxfcfpdwyjqcrfssxgbi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZmNmcGR3eWpxY3Jmc3N4Z2JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTk0NTUyNiwiZXhwIjoyMDQ3NTIxNTI2fQ.TBD'
)

console.log('⚠️  Este script requer acesso administrativo ao banco')
console.log('📋 Execute manualmente o SQL em:')
console.log('   https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql\n')
console.log('Conteúdo do arquivo CORRIGIR_RLS_DEV.sql:\n')
console.log('─'.repeat(60))
console.log(sql)
console.log('─'.repeat(60))
