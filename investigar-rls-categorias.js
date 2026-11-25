/**
 * INVESTIGAÇÃO: Erro de RLS em categorias
 * DEV gxfcfpdwyjqcrfssxgbi
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

console.log('═'.repeat(70));
console.log('🔍 INVESTIGAÇÃO: Erro de RLS em Categorias');
console.log('═'.repeat(70));
console.log();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  try {
    // ============================================================
    // TESTE 1: Tentar SELECT simples em categorias
    // ============================================================
    console.log('📊 Teste 1: SELECT em categorias (anon)...');
    console.log('─'.repeat(70));
    
    const { data, error, status, statusText } = await supabase
      .from('categorias')
      .select('*')
      .is('usuario_id', null)
      .limit(5);
    
    console.log('Status HTTP:', status);
    console.log('Status Text:', statusText);
    console.log();
    
    if (error) {
      console.log('❌ Erro recebido:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
      console.log();
      
      // Analisar tipo de erro
      if (error.message.includes('permission denied')) {
        console.log('🔍 DIAGNÓSTICO:');
        console.log('   Erro de permissão RLS detectado.');
        console.log('   O papel "anon" não tem acesso à tabela categorias.');
        console.log();
      }
    } else {
      console.log('✅ Sucesso!');
      console.log(`   Registros retornados: ${data?.length || 0}`);
      if (data && data.length > 0) {
        console.log('   Primeira categoria:', data[0].nome);
      }
      console.log();
    }
    
    // ============================================================
    // TESTE 2: Verificar se política existe e permite anon
    // ============================================================
    console.log('📊 Teste 2: Verificar políticas RLS (via API)...');
    console.log('─'.repeat(70));
    console.log('⚠️  Nota: Supabase Client não expõe políticas via API');
    console.log('   Verificação manual necessária via SQL Editor');
    console.log();
    
    // ============================================================
    // TESTE 3: Tentar com autenticação
    // ============================================================
    console.log('📊 Teste 3: Criar usuário de teste e autenticar...');
    console.log('─'.repeat(70));
    
    // Tentar criar usuário de teste
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'teste-rls@example.com',
      password: 'senha123456',
      options: {
        data: {
          nome: 'Teste RLS'
        }
      }
    });
    
    if (signUpError) {
      console.log('❌ Erro ao criar usuário:');
      console.log('   Message:', signUpError.message);
      console.log();
      
      if (signUpError.message.includes('already registered')) {
        console.log('ℹ️  Usuário já existe. Tentando login...');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'teste-rls@example.com',
          password: 'senha123456'
        });
        
        if (signInError) {
          console.log('❌ Erro ao fazer login:', signInError.message);
          console.log();
        } else if (signInData.session) {
          console.log('✅ Login bem-sucedido!');
          console.log('   User ID:', signInData.user.id);
          console.log('   Email:', signInData.user.email);
          console.log();
          
          // Tentar SELECT novamente com auth
          console.log('📊 Teste 4: SELECT em categorias (autenticado)...');
          console.log('─'.repeat(70));
          
          const { data: catData, error: catError } = await supabase
            .from('categorias')
            .select('*')
            .is('usuario_id', null)
            .limit(5);
          
          if (catError) {
            console.log('❌ Erro mesmo autenticado:');
            console.log('   Message:', catError.message);
            console.log();
          } else {
            console.log('✅ Sucesso com autenticação!');
            console.log(`   Categorias retornadas: ${catData?.length || 0}`);
            if (catData && catData.length > 0) {
              console.log('   Primeira categoria:', catData[0].nome);
            }
            console.log();
          }
        }
      }
    } else if (signUpData.user) {
      console.log('✅ Usuário criado com sucesso!');
      console.log('   User ID:', signUpData.user.id);
      console.log('   Email:', signUpData.user.email);
      console.log('   Confirmação necessária:', !signUpData.session);
      console.log();
      
      if (signUpData.session) {
        // Tentar SELECT com auth
        const { data: catData, error: catError } = await supabase
          .from('categorias')
          .select('*')
          .is('usuario_id', null)
          .limit(5);
        
        if (catError) {
          console.log('❌ Erro mesmo autenticado:', catError.message);
        } else {
          console.log('✅ Categorias acessíveis após autenticação!');
          console.log(`   Total: ${catData?.length || 0}`);
        }
        console.log();
      }
    }
    
    console.log('═'.repeat(70));
    console.log('📋 CONCLUSÃO DA INVESTIGAÇÃO');
    console.log('═'.repeat(70));
    console.log();
    console.log('Para diagnóstico completo, execute no SQL Editor:');
    console.log();
    console.log('-- Verificar políticas RLS');
    console.log('SELECT policyname, cmd, roles, qual, with_check');
    console.log('FROM pg_policies');
    console.log("WHERE schemaname = 'public' AND tablename = 'categorias';");
    console.log();
    console.log('-- Verificar permissões do papel anon');
    console.log('SELECT grantee, privilege_type');
    console.log('FROM information_schema.role_table_grants');
    console.log("WHERE table_schema = 'public'");
    console.log("  AND table_name = 'categorias'");
    console.log("  AND grantee = 'anon';");
    console.log();
    
  } catch (err) {
    console.error('❌ ERRO:', err.message);
  }
})();
