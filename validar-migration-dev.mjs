import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.development.local', 'utf-8');
const getEnv = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1];

const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_ANON_KEY'));

console.log('═══════════════════════════════════════════════════════════');
console.log('VALIDAÇÃO MIGRATION DEV');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Verificar tipos das 12 colunas
console.log('1️⃣ TIPOS DAS 12 COLUNAS:\n');
const { data: colunas } = await supabase.rpc('exec_sql', {
  query: `
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'perfis' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `
});

if (colunas) {
  colunas.forEach(c => {
    console.log(`  ${c.column_name.padEnd(25)} ${c.data_type.padEnd(12)} udt: ${c.udt_name.padEnd(10)} nullable: ${c.is_nullable}`);
  });
}

// 2. Verificar permissões efetivas
console.log('\n2️⃣ PERMISSÕES EFETIVAS (authenticated):\n');
const { data: perms } = await supabase.rpc('exec_sql', {
  query: `
    SELECT 
      has_table_privilege('authenticated', 'public.perfis', 'SELECT') as can_select,
      has_table_privilege('authenticated', 'public.perfis', 'INSERT') as can_insert,
      has_table_privilege('authenticated', 'public.perfis', 'UPDATE') as can_update_all,
      has_column_privilege('authenticated', 'public.perfis', 'papel', 'UPDATE') as can_update_papel,
      has_column_privilege('authenticated', 'public.perfis', 'ativo', 'UPDATE') as can_update_ativo,
      has_column_privilege('authenticated', 'public.perfis', 'onboarding_concluido', 'UPDATE') as can_update_onboarding;
  `
});

if (perms?.[0]) {
  Object.entries(perms[0]).forEach(([k, v]) => {
    const status = v ? '✅' : '❌';
    console.log(`  ${status} ${k}: ${v}`);
  });
}

// 3. Testar onboarding_concluido NULL
console.log('\n3️⃣ TESTE onboarding_concluido NULL:\n');
console.log('  Verificar se código trata NULL corretamente...');

const { data: testNull } = await supabase.rpc('exec_sql', {
  query: `
    SELECT 
      COUNT(*) FILTER (WHERE onboarding_concluido IS NULL) as com_null,
      COUNT(*) FILTER (WHERE onboarding_concluido = TRUE) as concluido,
      COUNT(*) FILTER (WHERE onboarding_concluido = FALSE) as nao_concluido
    FROM perfis;
  `
});

if (testNull?.[0]) {
  console.log(`  NULL: ${testNull[0].com_null}, TRUE: ${testNull[0].concluido}, FALSE: ${testNull[0].nao_concluido}`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('RESULTADO: Validação manual necessária');
console.log('═══════════════════════════════════════════════════════════');
