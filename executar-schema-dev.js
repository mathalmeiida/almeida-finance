/**
 * EXECUÇÃO REAL: Schema Base no Supabase DEV
 * Autorizado para gxfcfpdwyjqcrfssxgbi
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler credenciais
const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais não encontradas');
  process.exit(1);
}

console.log('═'.repeat(70));
console.log('🔍 VALIDAÇÃO REAL: Schema Base do Almeida Finance');
console.log('═'.repeat(70));
console.log('📍 Ambiente:', supabaseUrl);
console.log('🆔 Project ID:', supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]);
console.log('═'.repeat(70));

const supabase = createClient(supabaseUrl, supabaseKey);

// Verificar se é o ambiente correto
if (!supabaseUrl.includes('gxfcfpdwyjqcrfssxgbi')) {
  console.error('❌ ERRO: Ambiente incorreto!');
  console.error('   Esperado: gxfcfpdwyjqcrfssxgbi');
  console.error('   Encontrado:', supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]);
  process.exit(1);
}

console.log('✅ Ambiente DEV confirmado: gxfcfpdwyjqcrfssxgbi');
console.log();

(async () => {
  try {
    // ============================================================
    // ETAPA 1: Verificar estado atual do banco
    // ============================================================
    console.log('📊 ETAPA 1: Verificando estado atual do banco...');
    console.log('─'.repeat(70));
    
    // Testar conexão
    const { data: testData, error: testError } = await supabase
      .from('perfis')
      .select('count')
      .limit(1);
    
    if (testError && testError.code === '42P01') {
      console.log('✅ Banco vazio (tabela perfis não existe)');
      console.log('✅ Seguro para executar schema base');
    } else if (testError) {
      console.log('⚠️  Erro ao verificar banco:', testError.message);
      console.log('   Continuando com verificações...');
    } else {
      console.log('⚠️  ATENÇÃO: Tabela perfis JÁ EXISTE!');
      console.log('   Verificando outras tabelas...');
      
      // Verificar quais tabelas existem
      const tabelas = [
        'perfis', 'categorias', 'subcategorias', 'receitas', 
        'cartoes', 'despesas', 'despesas_tipo_excecoes', 
        'parcelamentos', 'metas', 'compras_cartao'
      ];
      
      let tabelasExistentes = [];
      for (const tabela of tabelas) {
        const { error } = await supabase.from(tabela).select('count').limit(0);
        if (!error || error.code !== '42P01') {
          tabelasExistentes.push(tabela);
        }
      }
      
      if (tabelasExistentes.length > 0) {
        console.log('⚠️  Tabelas existentes:', tabelasExistentes.join(', '));
        console.log('⚠️  Schema base pode já ter sido executado');
        console.log('⚠️  Script é idempotente (IF NOT EXISTS) mas pode haver dados');
      }
    }
    
    console.log();
    console.log('═'.repeat(70));
    console.log('⚠️  IMPORTANTE: A execução SQL deve ser feita MANUALMENTE');
    console.log('═'.repeat(70));
    console.log();
    console.log('📋 INSTRUÇÕES:');
    console.log('1. Acesse: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql');
    console.log('2. Clique em "New query"');
    console.log('3. Abra o arquivo: 01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql');
    console.log('4. Copie TODO o conteúdo (Ctrl+A, Ctrl+C)');
    console.log('5. Cole no SQL Editor (Ctrl+V)');
    console.log('6. Clique em "Run" (ou Ctrl+Enter)');
    console.log('7. Aguarde 30-60 segundos');
    console.log('8. Execute este script novamente para validar');
    console.log();
    console.log('═'.repeat(70));
    console.log('🚨 O Supabase não permite execução de SQL via API por segurança');
    console.log('   Use o SQL Editor do dashboard conforme instruções acima');
    console.log('═'.repeat(70));
    
  } catch (err) {
    console.error('❌ ERRO:', err.message);
    process.exit(1);
  }
})();
