/**
 * TESTE DE SINTAXE SQL NO BANCO DEV
 * Executa o SQL no Supabase DEV gxfcfpdwyjqcrfssxgbi
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler .env.development.local manualmente
const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.error('   Verifique .env.development.local');
  process.exit(1);
}

console.log('🔗 Conectando ao Supabase DEV...');
console.log(`📍 URL: ${supabaseUrl}`);
console.log('═'.repeat(60));

const supabase = createClient(supabaseUrl, supabaseKey);

// Ler SQL
const sql = readFileSync('01_EXECUTAR_SCHEMA_BASE.sql', 'utf-8');

console.log('\n⚠️  ATENÇÃO: Este script NÃO executa o SQL completo.');
console.log('   Apenas valida a conexão e verifica se o banco está vazio.');
console.log('   Execute o SQL manualmente no Supabase SQL Editor.');
console.log('═'.repeat(60));

(async () => {
  try {
    // Testar conexão
    const { data, error } = await supabase
      .from('perfis')
      .select('count')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('\n✅ BANCO VAZIO (tabela perfis não existe)');
      console.log('✅ PRONTO para executar 01_EXECUTAR_SCHEMA_BASE.sql');
      console.log('\n📋 PRÓXIMOS PASSOS:');
      console.log('   1. Acesse: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql');
      console.log('   2. Clique em "New query"');
      console.log('   3. Cole o conteúdo de 01_EXECUTAR_SCHEMA_BASE.sql');
      console.log('   4. Clique em "Run"');
      console.log('   5. Execute VALIDAR_SCHEMA_BASE_CORRIGIDO.sql para verificar');
      console.log('═'.repeat(60));
      process.exit(0);
    } else if (error) {
      console.error('\n❌ ERRO na conexão:', error.message);
      process.exit(1);
    } else {
      console.log('\n⚠️  ATENÇÃO: Tabelas já existem no banco!');
      console.log('   O schema base pode já ter sido executado.');
      console.log('   Verifique antes de executar novamente.');
      console.log('═'.repeat(60));
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    process.exit(1);
  }
})();
