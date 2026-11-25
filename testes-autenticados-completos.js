/**
 * TESTES AUTENTICADOS COMPLETOS - RLS e Isolamento
 * DEV gxfcfpdwyjqcrfssxgbi
 * 
 * Usa signUp/signInWithPassword para criar usuários reais
 * Testa com sessões JWT distintas (não service_role)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

console.log('═'.repeat(70));
console.log('🧪 TESTES AUTENTICADOS COMPLETOS - RLS e Isolamento');
console.log('═'.repeat(70));
console.log('📍 Ambiente:', supabaseUrl);
console.log('🔑 Usando: ANON KEY (respeita RLS)');
console.log('═'.repeat(70));
console.log();

let testesTotal = 0;
let testesPass = 0;
let testesFail = 0;
let testesSkip = 0;

function registrarTeste(numero, nome, status, mensagem, detalhes = null) {
  testesTotal++;
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  
  console.log(`${statusIcon} Teste ${numero}: ${nome}`);
  console.log(`   Status: ${status}`);
  console.log(`   ${mensagem}`);
  if (detalhes) {
    console.log(`   Detalhes:`, typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes, null, 2));
  }
  console.log();
  
  if (status === 'PASS') testesPass++;
  else if (status === 'FAIL') testesFail++;
  else if (status === 'SKIP') testesSkip++;
}

(async () => {
  try {
    // ============================================================
    // PREPARAÇÃO: Criar clientes Supabase para cada usuário
    // ============================================================
    console.log('📋 PREPARAÇÃO: Criando usuários de teste...');
    console.log('─'.repeat(70));
    
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    
    // IDs dos usuários
    let aliceId = null;
    let bobId = null;
    let aliceClient = null;
    let bobClient = null;
    
    // ============================================================
    // Criar/Autenticar Alice
    // ============================================================
    console.log('👤 Criando Alice (alice@test.dev)...');
    
    const { data: aliceSignUp, error: aliceSignUpError } = await supabaseAnon.auth.signUp({
      email: 'alice@test.dev',
      password: 'senha123456',
      options: {
        data: { nome: 'Alice' },
        emailRedirectTo: undefined // Desabilita confirmação
      }
    });
    
    if (aliceSignUpError && !aliceSignUpError.message.includes('already registered')) {
      console.log('❌ Erro ao criar Alice:', aliceSignUpError.message);
      console.log('⚠️  Continuando com testes limitados...\n');
    } else {
      if (aliceSignUpError?.message.includes('already registered')) {
        console.log('ℹ️  Alice já existe. Fazendo login...');
        
        const { data: aliceSignIn, error: aliceSignInError } = await supabaseAnon.auth.signInWithPassword({
          email: 'alice@test.dev',
          password: 'senha123456'
        });
        
        if (aliceSignInError) {
          console.log('❌ Erro ao autenticar Alice:', aliceSignInError.message);
        } else if (aliceSignIn.session) {
          aliceId = aliceSignIn.user.id;
          aliceClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: {
                Authorization: `Bearer ${aliceSignIn.session.access_token}`
              }
            }
          });
          console.log('✅ Alice autenticada:', aliceId);
        }
      } else if (aliceSignUp.session) {
        aliceId = aliceSignUp.user.id;
        aliceClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${aliceSignUp.session.access_token}`
            }
          }
        });
        console.log('✅ Alice criada:', aliceId);
      } else {
        console.log('⚠️  Alice criada mas requer confirmação de email');
      }
    }
    
    // ============================================================
    // Criar/Autenticar Bob
    // ============================================================
    console.log('👤 Criando Bob (bob@test.dev)...');
    
    const { data: bobSignUp, error: bobSignUpError } = await supabaseAnon.auth.signUp({
      email: 'bob@test.dev',
      password: 'senha123456',
      options: {
        data: { nome: 'Bob' },
        emailRedirectTo: undefined
      }
    });
    
    if (bobSignUpError && !bobSignUpError.message.includes('already registered')) {
      console.log('❌ Erro ao criar Bob:', bobSignUpError.message);
      console.log('⚠️  Continuando com testes limitados...\n');
    } else {
      if (bobSignUpError?.message.includes('already registered')) {
        console.log('ℹ️  Bob já existe. Fazendo login...');
        
        const { data: bobSignIn, error: bobSignInError } = await supabaseAnon.auth.signInWithPassword({
          email: 'bob@test.dev',
          password: 'senha123456'
        });
        
        if (bobSignInError) {
          console.log('❌ Erro ao autenticar Bob:', bobSignInError.message);
        } else if (bobSignIn.session) {
          bobId = bobSignIn.user.id;
          bobClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: {
                Authorization: `Bearer ${bobSignIn.session.access_token}`
              }
            }
          });
          console.log('✅ Bob autenticado:', bobId);
        }
      } else if (bobSignUp.session) {
        bobId = bobSignUp.user.id;
        bobClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${bobSignUp.session.access_token}`
            }
          }
        });
        console.log('✅ Bob criado:', bobId);
      } else {
        console.log('⚠️  Bob criado mas requer confirmação de email');
      }
    }
    
    console.log();
    
    // ============================================================
    // TESTES
    // ============================================================
    console.log('═'.repeat(70));
    console.log('🧪 EXECUTANDO TESTES');
    console.log('═'.repeat(70));
    console.log();
    
    // ============================================================
    // TESTE 1: Categorias do sistema visíveis sem auth
    // ============================================================
    const { data: catAnon, error: catAnonError } = await supabaseAnon
      .from('categorias')
      .select('*')
      .is('usuario_id', null)
      .limit(5);
    
    if (catAnonError) {
      registrarTeste(
        1,
        'Categorias do sistema visíveis sem auth',
        'FAIL',
        'RLS bloqueou acesso anônimo às categorias do sistema',
        { erro: catAnonError.message, hint: catAnonError.hint }
      );
    } else {
      registrarTeste(
        1,
        'Categorias do sistema visíveis sem auth',
        catAnon.length > 0 ? 'PASS' : 'FAIL',
        catAnon.length > 0 
          ? `${catAnon.length} categorias do sistema visíveis sem auth`
          : 'Nenhuma categoria retornada'
      );
    }
    
    // ============================================================
    // TESTE 2: Trigger - Criação automática de perfil
    // ============================================================
    if (aliceId && aliceClient) {
      const { data: alicePerfil, error: alicePerfilError } = await aliceClient
        .from('perfis')
        .select('*')
        .eq('id', aliceId)
        .single();
      
      if (alicePerfilError) {
        registrarTeste(
          2,
          'Trigger - Criação automática de perfil (Alice)',
          'FAIL',
          'Perfil de Alice não foi encontrado',
          { erro: alicePerfilError.message }
        );
      } else if (alicePerfil) {
        registrarTeste(
          2,
          'Trigger - Criação automática de perfil (Alice)',
          'PASS',
          `Perfil criado automaticamente: ${alicePerfil.nome || alicePerfil.email}`
        );
      }
    } else {
      registrarTeste(
        2,
        'Trigger - Criação automática de perfil',
        'SKIP',
        'Alice não autenticada'
      );
    }
    
    // ============================================================
    // TESTE 3: Alice cria uma meta
    // ============================================================
    let aliceMetaId = null;
    
    if (aliceId && aliceClient) {
      const { data: aliceMeta, error: aliceMetaError } = await aliceClient
        .from('metas')
        .insert({
          nome: 'Meta de Alice',
          valor_desejado: 5000
        })
        .select()
        .single();
      
      if (aliceMetaError) {
        registrarTeste(
          3,
          'Alice cria uma meta',
          'FAIL',
          'Alice não conseguiu criar meta',
          { erro: aliceMetaError.message }
        );
      } else {
        aliceMetaId = aliceMeta.id;
        registrarTeste(
          3,
          'Alice cria uma meta',
          'PASS',
          `Meta criada: ${aliceMeta.nome} - R$ ${aliceMeta.valor_desejado}`
        );
      }
    } else {
      registrarTeste(3, 'Alice cria uma meta', 'SKIP', 'Alice não autenticada');
    }
    
    // ============================================================
    // TESTE 4: Bob não vê meta de Alice
    // ============================================================
    if (bobId && bobClient && aliceMetaId) {
      const { data: bobVeMeta, error: bobVeMetaError } = await bobClient
        .from('metas')
        .select('*')
        .eq('id', aliceMetaId);
      
      if (bobVeMetaError) {
        registrarTeste(
          4,
          'Bob NÃO vê meta de Alice (isolamento SELECT)',
          'PASS',
          'RLS bloqueou acesso de Bob à meta de Alice',
          { erro: bobVeMetaError.message }
        );
      } else if (bobVeMeta.length === 0) {
        registrarTeste(
          4,
          'Bob NÃO vê meta de Alice (isolamento SELECT)',
          'PASS',
          'Bob não vê meta de Alice (array vazio)'
        );
      } else {
        registrarTeste(
          4,
          'Bob NÃO vê meta de Alice (isolamento SELECT)',
          'FAIL',
          `Bob VIU ${bobVeMeta.length} meta(s) de Alice! VULNERABILIDADE!`,
          { metas: bobVeMeta }
        );
      }
    } else {
      registrarTeste(
        4,
        'Bob NÃO vê meta de Alice',
        'SKIP',
        'Requer Bob autenticado e meta de Alice criada'
      );
    }
    
    // ============================================================
    // TESTE 5: Alice cria um cartão
    // ============================================================
    let aliceCartaoId = null;
    
    if (aliceId && aliceClient) {
      const { data: aliceCartao, error: aliceCartaoError } = await aliceClient
        .from('cartoes')
        .insert({
          nome: 'Cartão de Alice',
          limite_total: 5000,
          dia_fechamento: 10,
          dia_vencimento: 20
        })
        .select()
        .single();
      
      if (aliceCartaoError) {
        registrarTeste(
          5,
          'Alice cria um cartão',
          'FAIL',
          'Alice não conseguiu criar cartão',
          { erro: aliceCartaoError.message }
        );
      } else {
        aliceCartaoId = aliceCartao.id;
        registrarTeste(
          5,
          'Alice cria um cartão',
          'PASS',
          `Cartão criado: ${aliceCartao.nome} - Limite R$ ${aliceCartao.limite_total}`
        );
      }
    } else {
      registrarTeste(5, 'Alice cria um cartão', 'SKIP', 'Alice não autenticada');
    }
    
    // ============================================================
    // TESTE 6: Bob cria um cartão
    // ============================================================
    let bobCartaoId = null;
    
    if (bobId && bobClient) {
      const { data: bobCartao, error: bobCartaoError } = await bobClient
        .from('cartoes')
        .insert({
          nome: 'Cartão de Bob',
          limite_total: 3000,
          dia_fechamento: 15,
          dia_vencimento: 25
        })
        .select()
        .single();
      
      if (bobCartaoError) {
        registrarTeste(
          6,
          'Bob cria um cartão',
          'FAIL',
          'Bob não conseguiu criar cartão',
          { erro: bobCartaoError.message }
        );
      } else {
        bobCartaoId = bobCartao.id;
        registrarTeste(
          6,
          'Bob cria um cartão',
          'PASS',
          `Cartão criado: ${bobCartao.nome} - Limite R$ ${bobCartao.limite_total}`
        );
      }
    } else {
      registrarTeste(6, 'Bob cria um cartão', 'SKIP', 'Bob não autenticado');
    }
    
    // ============================================================
    // TESTE 7: Alice NÃO vê cartão de Bob
    // ============================================================
    if (aliceId && aliceClient && bobCartaoId) {
      const { data: aliceVeCartaoBob, error: aliceVeCartaoBobError } = await aliceClient
        .from('cartoes')
        .select('*')
        .eq('id', bobCartaoId);
      
      if (aliceVeCartaoBobError) {
        registrarTeste(
          7,
          'Alice NÃO vê cartão de Bob (isolamento)',
          'PASS',
          'RLS bloqueou acesso',
          { erro: aliceVeCartaoBobError.message }
        );
      } else if (aliceVeCartaoBob.length === 0) {
        registrarTeste(
          7,
          'Alice NÃO vê cartão de Bob (isolamento)',
          'PASS',
          'Alice não vê cartão de Bob (isolamento OK)'
        );
      } else {
        registrarTeste(
          7,
          'Alice NÃO vê cartão de Bob (isolamento)',
          'FAIL',
          'Alice VIU cartão de Bob! VULNERABILIDADE!',
          { cartoes: aliceVeCartaoBob }
        );
      }
    } else {
      registrarTeste(7, 'Alice NÃO vê cartão de Bob', 'SKIP', 'Requer ambos autenticados');
    }
    
    // ============================================================
    // TESTE 8: Alice tenta criar despesa com cartão de Bob
    // ============================================================
    if (aliceId && aliceClient && bobCartaoId) {
      const { data: despesaCrossBob, error: despesaCrossBobError } = await aliceClient
        .from('despesas')
        .insert({
          descricao: 'Tentativa de usar cartão de Bob',
          valor: 100,
          data: new Date().toISOString().split('T')[0],
          cartao_id: bobCartaoId
        })
        .select();
      
      if (despesaCrossBobError) {
        registrarTeste(
          8,
          'Alice NÃO pode criar despesa com cartão de Bob',
          'PASS',
          'RLS bloqueou tentativa (policy de ownership)',
          { erro: despesaCrossBobError.message }
        );
      } else {
        registrarTeste(
          8,
          'Alice NÃO pode criar despesa com cartão de Bob',
          'FAIL',
          'Alice CONSEGUIU criar despesa com cartão de Bob! VULNERABILIDADE CRÍTICA!',
          { despesa: despesaCrossBob }
        );
      }
    } else {
      registrarTeste(
        8,
        'Alice NÃO pode criar despesa com cartão de Bob',
        'SKIP',
        'Requer ambos autenticados e cartões criados'
      );
    }
    
    // ============================================================
    // TESTE 9: Alice cria despesa com próprio cartão
    // ============================================================
    if (aliceId && aliceClient && aliceCartaoId) {
      const { data: despesaAlice, error: despesaAliceError } = await aliceClient
        .from('despesas')
        .insert({
          descricao: 'Compra com próprio cartão',
          valor: 150,
          data: new Date().toISOString().split('T')[0],
          cartao_id: aliceCartaoId
        })
        .select()
        .single();
      
      if (despesaAliceError) {
        registrarTeste(
          9,
          'Alice cria despesa com próprio cartão',
          'FAIL',
          'Alice não conseguiu criar despesa com próprio cartão',
          { erro: despesaAliceError.message }
        );
      } else {
        registrarTeste(
          9,
          'Alice cria despesa com próprio cartão',
          'PASS',
          `Despesa criada: ${despesaAlice.descricao} - R$ ${despesaAlice.valor}`
        );
      }
    } else {
      registrarTeste(
        9,
        'Alice cria despesa com próprio cartão',
        'SKIP',
        'Requer Alice autenticada e cartão criado'
      );
    }
    
    // ============================================================
    // TESTE 10: Alice tenta criar compra com cartão de Bob
    // ============================================================
    if (aliceId && aliceClient && bobCartaoId) {
      const { data: compraCrossBob, error: compraCrossBobError } = await aliceClient
        .from('compras_cartao')
        .insert({
          cartao_id: bobCartaoId,
          descricao: 'Tentativa de compra com cartão de Bob',
          valor_total: 200,
          data_compra: new Date().toISOString().split('T')[0],
          numero_parcelas: 1
        })
        .select();
      
      if (compraCrossBobError) {
        registrarTeste(
          10,
          'Alice NÃO pode criar compra com cartão de Bob',
          'PASS',
          'RLS bloqueou tentativa (policy corrigida)',
          { erro: compraCrossBobError.message }
        );
      } else {
        registrarTeste(
          10,
          'Alice NÃO pode criar compra com cartão de Bob',
          'FAIL',
          'Alice CONSEGUIU criar compra com cartão de Bob! VULNERABILIDADE CRÍTICA!',
          { compra: compraCrossBob }
        );
      }
    } else {
      registrarTeste(
        10,
        'Alice NÃO pode criar compra com cartão de Bob',
        'SKIP',
        'Requer ambos autenticados e cartões criados'
      );
    }
    
    // ============================================================
    // TESTE 11: Alice cria compra com próprio cartão
    // ============================================================
    if (aliceId && aliceClient && aliceCartaoId) {
      const { data: compraAlice, error: compraAliceError } = await aliceClient
        .from('compras_cartao')
        .insert({
          cartao_id: aliceCartaoId,
          descricao: 'Compra parcelada com próprio cartão',
          valor_total: 600,
          data_compra: new Date().toISOString().split('T')[0],
          numero_parcelas: 3
        })
        .select()
        .single();
      
      if (compraAliceError) {
        registrarTeste(
          11,
          'Alice cria compra com próprio cartão',
          'FAIL',
          'Alice não conseguiu criar compra com próprio cartão',
          { erro: compraAliceError.message }
        );
      } else {
        registrarTeste(
          11,
          'Alice cria compra com próprio cartão',
          'PASS',
          `Compra criada: ${compraAlice.descricao} - R$ ${compraAlice.valor_total} em ${compraAlice.numero_parcelas}x`
        );
      }
    } else {
      registrarTeste(
        11,
        'Alice cria compra com próprio cartão',
        'SKIP',
        'Requer Alice autenticada e cartão criado'
      );
    }
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('═'.repeat(70));
    console.log('📊 RESUMO DOS TESTES');
    console.log('═'.repeat(70));
    console.log();
    console.log(`Total de testes: ${testesTotal}`);
    console.log(`✅ PASS:  ${testesPass}`);
    console.log(`❌ FAIL:  ${testesFail}`);
    console.log(`⏭️  SKIP:  ${testesSkip}`);
    console.log();
    
    if (testesFail === 0 && testesPass > 0) {
      console.log('✅ TODOS OS TESTES EXECUTADOS PASSARAM!');
    } else if (testesFail > 0) {
      console.log('❌ ALGUNS TESTES FALHARAM - REVISAR ACIMA');
    }
    
    if (testesSkip > 0) {
      console.log(`⚠️  ${testesSkip} testes pulados (requerem autenticação ou configuração)`);
    }
    
    console.log('═'.repeat(70));
    
    process.exit(testesFail > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('❌ ERRO CRÍTICO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
