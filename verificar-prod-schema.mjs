import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler .env.local manualmente (apenas linhas não-comentadas)
const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.trim().startsWith('#') || !line.includes('=')) return;
  const idx = line.indexOf('=');
  const key = line.substring(0, idx).trim();
  const value = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
  envVars[key] = value;
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

console.log('Lido:', { url: supabaseUrl?.substring(0, 30), key: supabaseKey?.substring(0, 20) });

console.log('🔍 Verificando esquema PRODUÇÃO');
console.log('URL:', supabaseUrl);
console.log('Projeto:', supabaseUrl?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]);

const supabase = createClient(supabaseUrl, supabaseKey);

// Query via API para listar colunas (via information_schema)
const { data, error } = await supabase.rpc('verificar_colunas_perfis');

if (error && error.code === '42883') {
  console.log('\n⚠️  Function verificar_colunas_perfis não existe em produção');
  console.log('📋 Executando query alternativa via REST API...\n');
  
  // Tentar via REST API direta
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/pg_get_tabledef`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tablename: 'perfis' })
    }
  );
  
  if (response.ok) {
    const result = await response.json();
    console.log('Definição tabela perfis:', result);
  } else {
    console.log('❌ REST API falhou:', response.status);
    console.log('\n📌 AÇÃO MANUAL NECESSÁRIA:');
    console.log('1. Acesse: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/editor');
    console.log('2. Abra SQL Editor');
    console.log('3. Execute:');
    console.log(`
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'perfis'
  AND table_schema = 'public'
ORDER BY ordinal_position;
    `);
    console.log('4. Copie o resultado completo');
  }
} else if (error) {
  console.log('❌ Erro:', error);
} else {
  console.log('✅ Colunas encontradas:', data);
}

// Listar colunas esperadas pelo código
console.log('\n📊 COLUNAS REQUERIDAS PELO CÓDIGO (12):');
const colunasRequeridas = [
  'id',
  'nome', 
  'email',
  'criado_em',
  'papel',
  'ativo',
  'ultimo_acesso',
  'onboarding_concluido',
  'objetivos_financeiros',
  'onboarding_etapa',
  'saldo_base',
  'saldo_base_data'
];
colunasRequeridas.forEach((col, i) => {
  console.log(`  ${i+1}. ${col}`);
});
