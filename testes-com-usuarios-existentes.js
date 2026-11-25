/**
 * TESTES COM USUÁRIOS EXISTENTES
 * Tenta login com alice@test.local e bob@test.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

console.log('═'.repeat(70));
console.log('🧪 TESTES RLS - Usando Usuários Existentes');
console.log('═'.repeat(70));
console.log();

let testesTotal = 0, testesPass = 0, testesFail = 0, testesSkip = 0;

function registrarTeste(numero, nome, status, mensagem, detalhes = null) {
  testesTotal++;
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  
  console.log(`${statusIcon} Teste ${numero}: ${nome}`);
  console.log(`   ${mensagem}`);
  if (detalhes) {
    const detalheStr = typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes, null, 2).substring(0, 200);
    console.log(`   ${detalheStr}${detalheStr.length >= 200 ? '...' : ''}`);
  }
  console.log();
  
  if (status === 'PASS') testesPass++;
  else if (status === 'FAIL') testesFail++;
  else if (status === 'SKIP') testesSkip++;
}

(async () => {
  try {
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    
    // ============================================================
    // TESTE 1: Categorias sem auth
    // ============================================================
    const { data: catAnon } = await supabaseAnon
      .from('categorias')
      .select('*')
      .is('usuario_id', null);
    
    registrarTeste(
      1,
      'Categorias do sistema visíveis sem auth',
      catAnon && catAnon.length === 19 ? 'PASS' : 'FAIL',
      catAnon ? `${catAnon.length} categorias (esperado 19)` : 'Erro ao buscar'
    );
    
    // ============================================================
    // TENTAR AUTENTICAR USUÁRIOS
    // ============================================================
    console.log('📋 Tentando autenticar usuários...');
    console.log('─'.repeat(70));
    
    let aliceClient = null, bobClient = null, aliceId = null, bobId = null;
    
    // Tentar Alice
    const { data: aliceAuth, error: aliceError } = await supabaseAnon.auth.signInWithPassword({
      email: 'alice@test.local',
      password: 'senha123456'
    });
    
    if (aliceError) {
      console.log('⚠️  Alice não autenticada:', aliceError.message);
      console.log('   Execute CRIAR_USUARIOS_MANUAL.sql primeiro\n');
    } else {
      aliceId = aliceAuth.user.id;
      aliceClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${aliceAuth.session.access_token}` }}
      });
      console.log('✅ Alice autenticada:', aliceId, '\n');
    }
    
    // Tentar Bob
    const { data: bobAuth, error: bobError } = await supabaseAnon.auth.signInWithPassword({
      email: 'bob@test.local',
      password: 'senha123456'
    });
    
    if (bobError) {
      console.log('⚠️  Bob não autenticado:', bobError.message);
      console.log('   Execute CRIAR_USUARIOS_MANUAL.sql primeiro\n');
    } else {
      bobId = bobAuth.user.id;
      bobClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${bobAuth.session.access_token}` }}
      });
      console.log('✅ Bob autenticado:', bobId, '\n');
    }
    
    // ============================================================
    // TESTE 2: Trigger de perfil
    // ============================================================
    if (aliceClient && aliceId) {
      const { data: perfil, error: perfilError } = await aliceClient
        .from('perfis')
        .select('*')
        .eq('id', aliceId)
        .single();
      
      if (perfilError) {
        registrarTeste(2, 'Trigger - Perfil de Alice criado', 'FAIL', 
          'Perfil não encontrado', perfilError.message);
      } else {
        registrarTeste(2, 'Trigger - Perfil de Alice criado', 'PASS',
          `Perfil: ${perfil.nome || perfil.email}`);
      }
    } else {
      registrarTeste(2, 'Trigger - Perfil criado', 'SKIP', 'Alice não autenticada');
    }
    
    // ============================================================
    // TESTE 3: Alice cria meta
    // ============================================================
    let aliceMetaId = null;
    if (aliceClient && aliceId) {
      const { data: meta, error: metaError } = await aliceClient
        .from('metas')
        .insert({ nome: 'Meta Teste Alice', valor_desejado: 5000 })
        .select()
        .single();
      
      if (metaError) {
        registrarTeste(3, 'Alice cria meta', 'FAIL', 'Erro ao criar', metaError.message);
      } else {
        aliceMetaId = meta.id;
        registrarTeste(3, 'Alice cria meta', 'PASS', `Meta: ${meta.nome} - R$ ${meta.valor_desejado}`);
      }
    } else {
      registrarTeste(3, 'Alice cria meta', 'SKIP', 'Alice não autenticada');
    }
    
    // ============================================================
    // TESTE 4: Bob NÃO vê meta de Alice
    // ============================================================
    if (bobClient && aliceMetaId) {
      const { data: bobVeMeta } = await bobClient
        .from('metas')
        .select('*')
        .eq('id', aliceMetaId);
      
      registrarTeste(4, 'Bob NÃO vê meta de Alice', 
        bobVeMeta.length === 0 ? 'PASS' : 'FAIL',
        bobVeMeta.length === 0 ? 'Isolamento OK' : `VULNERABILIDADE! Bob viu ${bobVeMeta.length} meta(s)`,
        bobVeMeta.length > 0 ? bobVeMeta : null
      );
    } else {
      registrarTeste(4, 'Bob NÃO vê meta de Alice', 'SKIP', 'Requer ambos autenticados');
    }
    
    // ============================================================
    // TESTE 5-6: Criar cartões
    // ============================================================
    let aliceCartaoId = null, bobCartaoId = null;
    
    if (aliceClient) {
      const { data: cartao, error } = await aliceClient
        .from('cartoes')
        .insert({ nome: 'Cartão Alice', limite_total: 5000, dia_fechamento: 10, dia_vencimento: 20 })
        .select()
        .single();
      
      if (error) {
        registrarTeste(5, 'Alice cria cartão', 'FAIL', 'Erro', error.message);
      } else {
        aliceCartaoId = cartao.id;
        registrarTeste(5, 'Alice cria cartão', 'PASS', `${cartao.nome} - R$ ${cartao.limite_total}`);
      }
    } else {
      registrarTeste(5, 'Alice cria cartão', 'SKIP', 'Alice não autenticada');
    }
    
    if (bobClient) {
      const { data: cartao, error } = await bobClient
        .from('cartoes')
        .insert({ nome: 'Cartão Bob', limite_total: 3000, dia_fechamento: 15, dia_vencimento: 25 })
        .select()
        .single();
      
      if (error) {
        registrarTeste(6, 'Bob cria cartão', 'FAIL', 'Erro', error.message);
      } else {
        bobCartaoId = cartao.id;
        registrarTeste(6, 'Bob cria cartão', 'PASS', `${cartao.nome} - R$ ${cartao.limite_total}`);
      }
    } else {
      registrarTeste(6, 'Bob cria cartão', 'SKIP', 'Bob não autenticado');
    }
    
    // ============================================================
    // TESTE 7: Alice NÃO vê cartão de Bob
    // ============================================================
    if (aliceClient && bobCartaoId) {
      const { data: aliceVeCartaoBob } = await aliceClient
        .from('cartoes')
        .select('*')
        .eq('id', bobCartaoId);
      
      registrarTeste(7, 'Alice NÃO vê cartão de Bob',
        aliceVeCartaoBob.length === 0 ? 'PASS' : 'FAIL',
        aliceVeCartaoBob.length === 0 ? 'Isolamento OK' : 'VULNERABILIDADE!',
        aliceVeCartaoBob.length > 0 ? aliceVeCartaoBob : null
      );
    } else {
      registrarTeste(7, 'Alice NÃO vê cartão de Bob', 'SKIP', 'Requer ambos');
    }
    
    // ============================================================
    // TESTE 8: Alice NÃO cria despesa com cartão de Bob (CRÍTICO)
    // ============================================================
    if (aliceClient && bobCartaoId) {
      const { data: despesa, error } = await aliceClient
        .from('despesas')
        .insert({
          descricao: 'Tentativa cartão Bob',
          valor: 100,
          data: new Date().toISOString().split('T')[0],
          cartao_id: bobCartaoId
        })
        .select();
      
      if (error) {
        registrarTeste(8, '🔐 Alice NÃO cria despesa c/ cartão Bob', 'PASS',
          'RLS bloqueou (policy de ownership)', error.message);
      } else {
        registrarTeste(8, '🔐 Alice NÃO cria despesa c/ cartão Bob', 'FAIL',
          '🚨 VULNERABILIDADE CRÍTICA! Despesa criada', despesa);
      }
    } else {
      registrarTeste(8, '🔐 Alice NÃO cria despesa c/ cartão Bob', 'SKIP', 'Requer ambos');
    }
    
    // ============================================================
    // TESTE 9: Alice cria despesa com próprio cartão
    // ============================================================
    if (aliceClient && aliceCartaoId) {
      const { data: despesa, error } = await aliceClient
        .from('despesas')
        .insert({
          descricao: 'Compra próprio cartão',
          valor: 150,
          data: new Date().toISOString().split('T')[0],
          cartao_id: aliceCartaoId
        })
        .select()
        .single();
      
      if (error) {
        registrarTeste(9, 'Alice cria despesa c/ próprio cartão', 'FAIL', 'Erro', error.message);
      } else {
        registrarTeste(9, 'Alice cria despesa c/ próprio cartão', 'PASS',
          `${despesa.descricao} - R$ ${despesa.valor}`);
      }
    } else {
      registrarTeste(9, 'Alice cria despesa c/ próprio cartão', 'SKIP', 'Requer Alice');
    }
    
    // ============================================================
    // TESTE 10: Alice NÃO cria compra com cartão de Bob (CRÍTICO)
    // ============================================================
    if (aliceClient && bobCartaoId) {
      const { data: compra, error } = await aliceClient
        .from('compras_cartao')
        .insert({
          cartao_id: bobCartaoId,
          descricao: 'Tentativa compra cartão Bob',
          valor_total: 200,
          data_compra: new Date().toISOString().split('T')[0],
          numero_parcelas: 1
        })
        .select();
      
      if (error) {
        registrarTeste(10, '🔐 Alice NÃO cria compra c/ cartão Bob', 'PASS',
          'RLS bloqueou (correção aplicada)', error.message);
      } else {
        registrarTeste(10, '🔐 Alice NÃO cria compra c/ cartão Bob', 'FAIL',
          '🚨 VULNERABILIDADE CRÍTICA! Compra criada', compra);
      }
    } else {
      registrarTeste(10, '🔐 Alice NÃO cria compra c/ cartão Bob', 'SKIP', 'Requer ambos');
    }
    
    // ============================================================
    // TESTE 11: Alice cria compra com próprio cartão
    // ============================================================
    if (aliceClient && aliceCartaoId) {
      const { data: compra, error } = await aliceClient
        .from('compras_cartao')
        .insert({
          cartao_id: aliceCartaoId,
          descricao: 'Compra parcelada próprio cartão',
          valor_total: 600,
          data_compra: new Date().toISOString().split('T')[0],
          numero_parcelas: 3
        })
        .select()
        .single();
      
      if (error) {
        registrarTeste(11, 'Alice cria compra c/ próprio cartão', 'FAIL', 'Erro', error.message);
      } else {
        registrarTeste(11, 'Alice cria compra c/ próprio cartão', 'PASS',
          `${compra.descricao} - ${compra.numero_parcelas}x de R$ ${(compra.valor_total/compra.numero_parcelas).toFixed(2)}`);
      }
    } else {
      registrarTeste(11, 'Alice cria compra c/ próprio cartão', 'SKIP', 'Requer Alice');
    }
    
    // ============================================================
    // RESUMO
    // ============================================================
    console.log('═'.repeat(70));
    console.log('📊 RESUMO DOS TESTES');
    console.log('═'.repeat(70));
    console.log(`Total: ${testesTotal} | ✅ PASS: ${testesPass} | ❌ FAIL: ${testesFail} | ⏭️ SKIP: ${testesSkip}`);
    console.log();
    
    if (testesFail === 0 && testesPass > 0) {
      console.log('✅ TODOS OS TESTES EXECUTADOS PASSARAM!');
    } else if (testesFail > 0) {
      console.log('❌ ALGUNS TESTES FALHARAM - VULNERABILIDADES ENCONTRADAS!');
    }
    
    if (testesSkip > 0) {
      console.log(`⚠️  ${testesSkip} testes pulados (criar usuários: CRIAR_USUARIOS_MANUAL.sql)`);
    }
    
    console.log('═'.repeat(70));
    
    process.exit(testesFail > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('❌ ERRO:', err.message);
    process.exit(1);
  }
})();
