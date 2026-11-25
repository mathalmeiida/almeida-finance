/**
 * TESTE: Leitura anônima de categorias (pós-correção)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

console.log('🧪 TESTE: Categorias do sistema visíveis sem autenticação\n');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  const { data, error, status } = await supabase
    .from('categorias')
    .select('*')
    .is('usuario_id', null)
    .order('nome');
  
  console.log('Status HTTP:', status);
  console.log();
  
  if (error) {
    console.log('❌ FAIL: Erro ao buscar categorias');
    console.log('   Code:', error.code);
    console.log('   Message:', error.message);
    console.log('   Hint:', error.hint);
    process.exit(1);
  }
  
  console.log('✅ PASS: Categorias retornadas com sucesso!');
  console.log(`   Total: ${data.length} categorias`);
  console.log();
  
  if (data.length !== 19) {
    console.log('⚠️  Esperado: 19 categorias');
    console.log(`   Encontrado: ${data.length} categorias`);
    console.log();
  }
  
  // Contar por tipo
  const porTipo = data.reduce((acc, cat) => {
    acc[cat.tipo] = (acc[cat.tipo] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📊 Distribuição por tipo:');
  console.log('   Despesa:', porTipo.despesa || 0);
  console.log('   Receita:', porTipo.receita || 0);
  console.log('   Ambos:', porTipo.ambos || 0);
  console.log();
  
  console.log('📋 Categorias encontradas:');
  data.forEach(cat => {
    console.log(`   - ${cat.nome} (${cat.tipo})`);
  });
  
  process.exit(0);
})();
