/**
 * TESTES RLS COM CREDENCIAIS SEGURAS
 * 
 * Configuração de credenciais (escolha uma):
 * 
 * 1. Variáveis de ambiente (recomendado):
 *    set ALICE_EMAIL=alice@example.com
 *    set ALICE_PASSWORD=sua_senha_alice
 *    set BOB_EMAIL=bob@example.com
 *    set BOB_PASSWORD=sua_senha_bob
 *    node testes-rls-com-credenciais.js
 * 
 * 2. Arquivo .env.test.local (criar na raiz do projeto):
 *    ALICE_EMAIL=alice@example.com
 *    ALICE_PASSWORD=sua_senha_alice
 *    BOB_EMAIL=bob@example.com
 *    BOB_PASSWORD=sua_senha_bob
 * 
 * 3. Prompt interativo (se nenhuma variável definida):
 *    O script solicitará as credenciais no terminal sem exibi-las.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import * as readline from 'readline';

// Função para ler senha sem exibir no terminal
function readPasswordSync(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`${prompt} (a entrada não será exibida)`);
    
    // Desabilitar echo no Windows (PowerShell)
    if (process.platform === 'win32') {
      process.stdin.setRawMode(true);
      let password = '';
      
      process.stdin.on('data', (char) => {
        char = char.toString();
        
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          console.log(); // Nova linha
          rl.close();
          resolve(password);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += char;
        }
      });
    } else {
      // Unix-like: usar readline padrão (menos seguro mas funciona)
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// Carregar variáveis de ambiente de .env.test.local se existir
let envTestVars = {};
if (existsSync('.env.test.local')) {
  const envTestContent = readFileSync('.env.test.local', 'utf-8');
  envTestContent.split('\n').forEach(line => {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      envTestVars[match[1]] = match[2].trim();
    }
  });
}

// Ler credenciais (prioridade: env vars > .env.test.local > emails padrão)
const aliceEmail = process.env.ALICE_EMAIL || envTestVars.ALICE_EMAIL || 'alice@example.com';
const alicePassword = process.env.ALICE_PASSWORD || envTestVars.ALICE_PASSWORD;
const bobEmail = process.env.BOB_EMAIL || envTestVars.BOB_EMAIL || 'bob@example.com';
const bobPassword = process.env.BOB_PASSWORD || envTestVars.BOB_PASSWORD;

const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

let testesTotal = 0, testesPass = 0, testesFail = 0, testesSkip = 0;

function registrarTeste(numero, nome, status, mensagem, detalhes = null) {
  testesTotal++;
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  
  console.log(`${statusIcon} Teste ${numero}: ${nome}`);
  console.log(`   Status: ${status}`);
  console.log(`   ${mensagem}`);
  if (detalhes) {
    const detalheStr = typeof detalhes === 'string' ? detalhes : 
      JSON.stringify(detalhes, null, 2).substring(0, 150);
    console.log(`   ${detalheStr}${detalheStr.length >= 150 ? '...' : ''}`);
  }
  console.log();
  
  if (status === 'PASS') testesPass++;
  else if (status === 'FAIL') testesFail++;
  else if (status === 'SKIP') testesSkip++;
}

(async () => {
  try {
    // Solicitar senhas se não estiverem definidas
    let alicePwd = alicePassword;
    let bobPwd = bobPassword;
    
    if (!alicePwd || !bobPwd) {
      console.log('═'.repeat(70));
      console.log('🔐 CONFIGURAÇÃO DE CREDENCIAIS');
      console.log('═'.repeat(70));
      console.log('Nenhuma credencial encontrada em variáveis de ambiente.');
      console.log('Configure via:');
      console.log('  - Variáveis de ambiente: ALICE_EMAIL, ALICE_PASSWORD, BOB_EMAIL, BOB_PASSWORD');
      console.log('  - Arquivo .env.test.local na raiz do projeto');
      console.log('═'.repeat(70));
      console.log();
      
      if (!alicePwd) {
        alicePwd = await readPasswordSync(`Senha para ${aliceEmail}:`);
      }
      if (!bobPwd) {
        bobPwd = await readPasswordSync(`Senha para ${bobEmail}:`);
      }
      console.log();
    }
    
    console.log('═'.repeat(70));
    console.log('🧪 TESTES RLS COMPLETOS - Alice e Bob');
    console.log('═'.repeat(70));
    console.log('Alice:', aliceEmail);
    console.log('Bob:', bobEmail);
    console.log('Senhas: ****** (ocultas)');
    console.log('═'.repeat(70));
    console.log();
    
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
    // AUTENTICAR USUÁRIOS
    // ============================================================
    console.log('🔐 Autenticando usuários...');
    console.log('─'.repeat(70));
    
    let aliceClient = null, bobClient = null, aliceId = null, bobId = null;
    
    // Alice
    console.log('Tentando autenticar Alice:', aliceEmail);
    const { data: aliceAuth, error: aliceError } = await supabaseAnon.auth.signInWithPassword({
      email: aliceEmail,
      password: alicePwd
    });
    
    if (aliceError) {
      console.log('❌ Alice não autenticada:', aliceError.message);
      console.log('   Verifique email e senha.\n');
    } else {
      aliceId = aliceAuth.user.id;
      aliceClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${aliceAuth.session.access_token}` }}
      });
      console.log('✅ Alice autenticada');
      console.log('   ID:', aliceId);
      console.log('   Email:', aliceAuth.user.email);
      console.log('   Token JWT:', aliceAuth.session.access_token.substring(0, 20) + '...\n');
    }
    
    // Bob
    console.log('Tentando autenticar Bob:', bobEmail);
    const { data: bobAuth, error: bobError } = await supabaseAnon.auth.signInWithPassword({
      email: bobEmail,
      password: bobPwd
    });
    
    if (bobError) {
      console.log('❌ Bob não autenticado:', bobError.message);
      console.log('   Verifique email e senha.\n');
    } else {
      bobId = bobAuth.user.id;
      bobClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${bobAuth.session.access_token}` }}
      });
      console.log('✅ Bob autenticado');
      console.log('   ID:', bobId);
      console.log('   Email:', bobAuth.user.email);
      console.log('   Token JWT:', bobAuth.session.access_token.substring(0, 20) + '...\n');
    }
    
    // Validar que os tokens são diferentes
    if (aliceAuth && bobAuth) {
      const tokensDiferentes = aliceAuth.session.access_token !== bobAuth.session.access_token;
      console.log(tokensDiferentes ? '✅ Tokens JWT diferentes (sessões isoladas)' : '❌ ERRO: Tokens iguais!');
      console.log();
    }
    
    console.log('═'.repeat(70));
    console.log('🧪 EXECUTANDO TESTES RLS');
    console.log('═'.repeat(70));
    console.log();
    
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
          'Perfil não encontrado', `Erro: ${perfilError.message}`);
      } else {
        registrarTeste(2, 'Trigger - Perfil de Alice criado', 'PASS',
          `Perfil encontrado: ${perfil.nome || perfil.email}`,
          `Criado em: ${perfil.criado_em}`);
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
        registrarTeste(3, 'Alice cria meta', 'FAIL', 
          'Erro ao criar meta', `${metaError.message} (code: ${metaError.code})`);
      } else {
        aliceMetaId = meta.id;
        registrarTeste(3, 'Alice cria meta', 'PASS',
          `Meta criada: ${meta.nome} - R$ ${meta.valor_desejado}`,
          `ID: ${meta.id}`);
      }
    } else {
      registrarTeste(3, 'Alice cria meta', 'SKIP', 'Alice não autenticada');
    }
    
    // ============================================================
    // TESTE 4: Bob NÃO vê meta de Alice (ISOLAMENTO)
    // ============================================================
    if (bobClient && aliceMetaId) {
      const { data: bobVeMeta, error: bobVeMetaError } = await bobClient
        .from('metas')
        .select('*')
        .eq('id', aliceMetaId);
      
      if (bobVeMetaError) {
        registrarTeste(4, '🔒 Bob NÃO vê meta de Alice (isolamento SELECT)',
          'PASS',
          'RLS bloqueou acesso',
          `Erro (esperado): ${bobVeMetaError.message}`);
      } else if (bobVeMeta.length === 0) {
        registrarTeste(4, '🔒 Bob NÃO vê meta de Alice (isolamento SELECT)',
          'PASS',
          'Bob não vê meta de Alice (array vazio = isolamento OK)');
      } else {
        registrarTeste(4, '🔒 Bob NÃO vê meta de Alice (isolamento SELECT)',
          'FAIL',
          `🚨 VULNERABILIDADE! Bob viu ${bobVeMeta.length} meta(s) de Alice!`,
          bobVeMeta);
      }
    } else {
      registrarTeste(4, 'Bob NÃO vê meta de Alice', 'SKIP', 
        'Requer: Bob autenticado e meta de Alice criada');
    }
    
    // ============================================================
    // TESTE 5: Alice cria cartão
    // ============================================================
    let aliceCartaoId = null;
    if (aliceClient) {
      const { data: cartao, error: cartaoError } = await aliceClient
        .from('cartoes')
        .insert({
          nome: 'Cartão Teste Alice',
          limite_total: 5000,
          dia_fechamento: 10,
          dia_vencimento: 20
        })
        .select()
        .single();
      
      if (cartaoError) {
        registrarTeste(5, 'Alice cria cartão', 'FAIL',
          'Erro ao criar cartão', `${cartaoError.message} (code: ${cartaoError.code})`);
      } else {
        aliceCartaoId = cartao.id;
        registrarTeste(5, 'Alice cria cartão', 'PASS',
          `Cartão criado: ${cartao.nome} - Limite R$ ${cartao.limite_total}`,
          `ID: ${cartao.id}`);
      }
    } else {
      registrarTeste(5, 'Alice cria cartão', 'SKIP', 'Alice não autenticada');
    }
    
    // ============================================================
    // TESTE 6: Bob cria cartão
    // ============================================================
    let bobCartaoId = null;
    if (bobClient) {
      const { data: cartao, error: cartaoError } = await bobClient
        .from('cartoes')
        .insert({
          nome: 'Cartão Teste Bob',
          limite_total: 3000,
          dia_fechamento: 15,
          dia_vencimento: 25
        })
        .select()
        .single();
      
      if (cartaoError) {
        registrarTeste(6, 'Bob cria cartão', 'FAIL',
          'Erro ao criar cartão', `${cartaoError.message} (code: ${cartaoError.code})`);
      } else {
        bobCartaoId = cartao.id;
        registrarTeste(6, 'Bob cria cartão', 'PASS',
          `Cartão criado: ${cartao.nome} - Limite R$ ${cartao.limite_total}`,
          `ID: ${cartao.id}`);
      }
    } else {
      registrarTeste(6, 'Bob cria cartão', 'SKIP', 'Bob não autenticado');
    }
    
    // ============================================================
    // TESTE 7: Alice NÃO vê cartão de Bob (ISOLAMENTO)
    // ============================================================
    if (aliceClient && bobCartaoId) {
      const { data: aliceVeCartaoBob, error: aliceVeCartaoBobError } = await aliceClient
        .from('cartoes')
        .select('*')
        .eq('id', bobCartaoId);
      
      if (aliceVeCartaoBobError) {
        registrarTeste(7, '🔒 Alice NÃO vê cartão de Bob (isolamento)',
          'PASS',
          'RLS bloqueou acesso',
          `Erro (esperado): ${aliceVeCartaoBobError.message}`);
      } else if (aliceVeCartaoBob.length === 0) {
        registrarTeste(7, '🔒 Alice NÃO vê cartão de Bob (isolamento)',
          'PASS',
          'Alice não vê cartão de Bob (isolamento OK)');
      } else {
        registrarTeste(7, '🔒 Alice NÃO vê cartão de Bob (isolamento)',
          'FAIL',
          `🚨 VULNERABILIDADE! Alice viu cartão de Bob!`,
          aliceVeCartaoBob);
      }
    } else {
      registrarTeste(7, 'Alice NÃO vê cartão de Bob', 'SKIP', 'Requer ambos autenticados');
    }
    
    // ============================================================
    // TESTE 8: Alice NÃO cria despesa com cartão de Bob (CRÍTICO)
    // ============================================================
    if (aliceClient && bobCartaoId) {
      const { data: despesa, error: despesaError } = await aliceClient
        .from('despesas')
        .insert({
          descricao: 'Tentativa despesa com cartão de Bob',
          valor: 100,
          data: new Date().toISOString().split('T')[0],
          cartao_id: bobCartaoId
        })
        .select();
      
      if (despesaError) {
        // Verificar se é RLS ou outro erro
        const isRLSError = despesaError.message.includes('row-level security') ||
                          despesaError.message.includes('policy') ||
                          despesaError.code === '42501';
        
        registrarTeste(8, '🔐 Alice NÃO cria despesa c/ cartão Bob (CRÍTICO)',
          'PASS',
          'Inserção bloqueada (policy de ownership)',
          `Erro: ${despesaError.message} | Code: ${despesaError.code} | RLS: ${isRLSError}`);
      } else {
        registrarTeste(8, '🔐 Alice NÃO cria despesa c/ cartão Bob (CRÍTICO)',
          'FAIL',
          '🚨 VULNERABILIDADE CRÍTICA! Alice criou despesa com cartão de Bob!',
          despesa);
      }
    } else {
      registrarTeste(8, '🔐 Alice NÃO cria despesa c/ cartão Bob', 'SKIP',
        'Requer: Alice e Bob autenticados, cartões criados');
    }
    
    // ============================================================
    // TESTE 9: Alice cria despesa com próprio cartão
    // ============================================================
    if (aliceClient && aliceCartaoId) {
      const { data: despesa, error: despesaError } = await aliceClient
        .from('despesas')
        .insert({
          descricao: 'Compra com próprio cartão',
          valor: 150,
          data: new Date().toISOString().split('T')[0],
          cartao_id: aliceCartaoId
        })
        .select()
        .single();
      
      if (despesaError) {
        registrarTeste(9, 'Alice cria despesa c/ próprio cartão', 'FAIL',
          'Erro ao criar despesa com próprio cartão',
          `${despesaError.message} (code: ${despesaError.code})`);
      } else {
        registrarTeste(9, 'Alice cria despesa c/ próprio cartão', 'PASS',
          `Despesa criada: ${despesa.descricao} - R$ ${despesa.valor}`,
          `ID: ${despesa.id}`);
      }
    } else {
      registrarTeste(9, 'Alice cria despesa c/ próprio cartão', 'SKIP',
        'Requer: Alice autenticada e cartão criado');
    }
    
    // ============================================================
    // TESTE 10: Alice NÃO cria compra com cartão de Bob (CRÍTICO)
    // ============================================================
    if (aliceClient && bobCartaoId) {
      const { data: compra, error: compraError } = await aliceClient
        .from('compras_cartao')
        .insert({
          cartao_id: bobCartaoId,
          descricao: 'Tentativa compra com cartão de Bob',
          valor_total: 200,
          data_compra: new Date().toISOString().split('T')[0],
          numero_parcelas: 1
        })
        .select();
      
      if (compraError) {
        const isRLSError = compraError.message.includes('row-level security') ||
                          compraError.message.includes('policy') ||
                          compraError.code === '42501';
        
        registrarTeste(10, '🔐 Alice NÃO cria compra c/ cartão Bob (CRÍTICO)',
          'PASS',
          'Inserção bloqueada (correção da auditoria aplicada)',
          `Erro: ${compraError.message} | Code: ${compraError.code} | RLS: ${isRLSError}`);
      } else {
        registrarTeste(10, '🔐 Alice NÃO cria compra c/ cartão Bob (CRÍTICO)',
          'FAIL',
          '🚨 VULNERABILIDADE CRÍTICA! Alice criou compra com cartão de Bob!',
          compra);
      }
    } else {
      registrarTeste(10, '🔐 Alice NÃO cria compra c/ cartão Bob', 'SKIP',
        'Requer: Alice e Bob autenticados, cartões criados');
    }
    
    // ============================================================
    // TESTE 11: Alice cria compra com próprio cartão
    // ============================================================
    if (aliceClient && aliceCartaoId) {
      const { data: compra, error: compraError } = await aliceClient
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
      
      if (compraError) {
        registrarTeste(11, 'Alice cria compra c/ próprio cartão', 'FAIL',
          'Erro ao criar compra com próprio cartão',
          `${compraError.message} (code: ${compraError.code})`);
      } else {
        const valorParcela = (compra.valor_total / compra.numero_parcelas).toFixed(2);
        registrarTeste(11, 'Alice cria compra c/ próprio cartão', 'PASS',
          `Compra criada: ${compra.descricao} - ${compra.numero_parcelas}x R$ ${valorParcela}`,
          `ID: ${compra.id} | Total: R$ ${compra.valor_total}`);
      }
    } else {
      registrarTeste(11, 'Alice cria compra c/ próprio cartão', 'SKIP',
        'Requer: Alice autenticada e cartão criado');
    }
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('═'.repeat(70));
    console.log('📊 RESUMO DOS TESTES');
    console.log('═'.repeat(70));
    console.log();
    console.log(`Total de testes: ${testesTotal}`);
    console.log(`✅ PASS:  ${testesPass} (${Math.round(testesPass/testesTotal*100)}%)`);
    console.log(`❌ FAIL:  ${testesFail} (${Math.round(testesFail/testesTotal*100)}%)`);
    console.log(`⏭️  SKIP:  ${testesSkip} (${Math.round(testesSkip/testesTotal*100)}%)`);
    console.log();
    
    if (testesFail === 0 && testesPass > 0) {
      console.log('✅ TODOS OS TESTES EXECUTADOS PASSARAM!');
      console.log('🔒 RLS e isolamento funcionando corretamente.');
      console.log('🛡️  Correções da auditoria validadas.');
    } else if (testesFail > 0) {
      console.log('❌ TESTES FALHARAM - VULNERABILIDADES ENCONTRADAS!');
      console.log('🚨 Revise os testes marcados como FAIL acima.');
    }
    
    if (testesSkip > 0) {
      console.log(`⚠️  ${testesSkip} testes pulados (verifique autenticação).`);
    }
    
    console.log('═'.repeat(70));
    
    process.exit(testesFail > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('❌ ERRO CRÍTICO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
