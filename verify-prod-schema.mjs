import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf-8');
const lines = env.split('\n').filter(l => !l.trim().startsWith('#') && l.includes('='));

const getEnv = (key) => {
  const line = lines.find(l => l.startsWith(key + '='));
  if (!line) return null;
  return line.substring(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
};

const url = getEnv('VITE_SUPABASE_URL');
const key = getEnv('VITE_SUPABASE_ANON_KEY');

console.log('🔍 Tentando verificar schema PRODUÇÃO');
console.log('URL:', url);
console.log('Key prefix:', key?.substring(0, 15) + '...');

if (!url || !key) {
  console.log('\n❌ Credenciais não encontradas em .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

// Tentar query simples na tabela perfis para inferir schema
console.log('\n📊 Tentando query SELECT em perfis (limit 0)...');

const { data, error } = await supabase
  .from('perfis')
  .select('*')
  .limit(0);

if (error) {
  console.log('❌ Erro:', error.message, `(code: ${error.code})`);
  
  if (error.code === 'PGRST204') {
    console.log('\n✅ Tabela existe mas está vazia (esperado com RLS)');
    console.log('⚠️  Não consegui inferir schema via API anon\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 AÇÃO MANUAL NECESSÁRIA');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Acesse o SQL Editor do projeto ievccupeijzuzhomphwn:');
  console.log('https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/editor\n');
  console.log('Execute:');
  console.log('  SELECT column_name, data_type, is_nullable');
  console.log('  FROM information_schema.columns');
  console.log("  WHERE table_name = 'perfis' AND table_schema = 'public'");
  console.log('  ORDER BY ordinal_position;\n');
  console.log('Cole o resultado completo aqui.');
  
  process.exit(1);
}

console.log('✅ Query bem-sucedida');
console.log('Data:', data);

// Se conseguiu retornar data (mesmo vazio), pode haver metadata
console.log('\n⚠️  API retornou mas não consegui extrair schema definitivo');
console.log('Necessário verificação manual no SQL Editor.');

process.exit(1);
