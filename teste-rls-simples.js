/**
 * TESTES SIMPLES DE RLS - DEV gxfcfpdwyjqcrfssxgbi
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

console.log('🧪 TESTES DE RLS - DEV gxfcfpdwyjqcrfssxgbi\n');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

let pass = 0, fail = 0, skip = 0;

async function teste(nome, fn) {
  try {
    const resultado = await fn();
    if (resultado === 'SKIP') {
      skip++;
      console.log(`⏭️  SKIP: ${nome}\n`);
    } else if (resultado) {
      pass++;
      console.log(`✅ PASS: ${nome}\n`);
    } else {
      fail++;
      console.log(`❌ FAIL: ${nome}\n`);
    }
  } catch (err) {
    fail++;
    console.log(`❌ FAIL: ${nome}`);
    console.log(`   Erro: ${err.message}\n`);
  }
}

(async () => {
  // Teste 1: Categorias do sistema visíveis sem auth
  await teste('Categorias do sistema visíveis sem auth', async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .is('usuario_id', null)
      .limit(1);
    
    if (error) {
      console.log(`   Erro: ${error.message}`);
      return false;
    }
    console.log(`   Encontradas: ${data?.length || 0} categorias`);
    return data && data.length > 0;
  });
  
  // Teste 2: RLS bloqueia SELECT em perfis sem auth
  await teste('RLS bloqueia SELECT em perfis (sem auth)', async () => {
    const { data, error } = await supabase
      .from('perfis')
      .select('*');
    
    // Espera array vazio ou erro
    if (error) {
      console.log(`   RLS ativo (erro esperado): ${error.message}`);
      return true;
    }
    console.log(`   Registros visíveis: ${data?.length || 0}`);
    return data.length === 0;
  });
  
  // Teste 3: RLS bloqueia INSERT em metas sem auth
  await teste('RLS bloqueia INSERT em metas (sem auth)', async () => {
    const { data, error } = await supabase
      .from('metas')
      .insert({
        usuario_id: '00000000-0000-0000-0000-000000000000',
        nome: 'Teste',
        valor_desejado: 1000
      })
      .select();
    
    if (error) {
      console.log(`   RLS ativo (insert bloqueado): ${error.message}`);
      return true;
    }
    console.log(`   ❌ INSERT aceito sem auth!`);
    return false;
  });
  
  // Teste 4: FK valida cartao_id inválido
  await teste('Foreign Key valida cartao_id inválido', async () => {
    const { error } = await supabase
      .from('despesas')
      .insert({
        usuario_id: '00000000-0000-0000-0000-000000000000',
        descricao: 'Teste',
        valor: 100,
        data: '2024-01-01',
        cartao_id: '99999999-9999-9999-9999-999999999999'
      });
    
    // Espera erro (RLS ou FK)
    if (error) {
      console.log(`   Bloqueado: ${error.message.substring(0, 80)}...`);
      return true;
    }
    return false;
  });
  
  // Testes que requerem auth
  console.log('⏭️  SKIP: Trigger - Criação automática de perfil');
  console.log('   Requer: Criar novo usuário via Auth\n');
  skip++;
  
  console.log('⏭️  SKIP: Isolamento SELECT entre usuários');
  console.log('   Requer: 2 usuários autenticados (Alice e Bob)\n');
  skip++;
  
  console.log('⏭️  SKIP: Validação de cartão em despesas (cross-user)');
  console.log('   Requer: Alice tentar vincular despesa ao cartão de Bob\n');
  skip++;
  
  console.log('⏭️  SKIP: Validação de cartão em compras_cartao (cross-user)');
  console.log('   Requer: Alice tentar vincular compra ao cartão de Bob\n');
  skip++;
  
  console.log('═'.repeat(70));
  console.log(`📊 RESUMO: ${pass} PASS | ${fail} FAIL | ${skip} SKIP`);
  console.log('═'.repeat(70));
  
  if (fail === 0 && pass > 0) {
    console.log('\n✅ Todos os testes executáveis passaram!');
    console.log('⚠️  Testes com auth requerem criação manual de usuários.');
  } else if (fail > 0) {
    console.log('\n❌ Alguns testes falharam. Revise os erros acima.');
  }
  
  process.exit(fail > 0 ? 1 : 0);
})();
