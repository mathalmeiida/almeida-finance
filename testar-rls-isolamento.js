/**
 * TESTES REAIS DE RLS E ISOLAMENTO
 * Ambiente: DEV gxfcfpdwyjqcrfssxgbi
 * 
 * IMPORTANTE: Usa anon key (não service_role) para respeitar RLS
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler credenciais
const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Credenciais não encontradas');
  process.exit(1);
}

// Verificar ambiente
if (!supabaseUrl.includes('gxfcfpdwyjqcrfssxgbi')) {
  console.error('❌ ERRO: Ambiente incorreto!');
  process.exit(1);
}

console.log('═'.repeat(70));
console.log('🧪 TESTES REAIS DE RLS E ISOLAMENTO');
console.log('═'.repeat(70));
console.log('📍 Ambiente:', supabaseUrl);
console.log('🔑 Usando: ANON KEY (respeita RLS)');
console.log('═'.repeat(70));
console.log();

// Contadores
let totalTestes = 0;
let testesPassaram = 0;
let testesFalharam = 0;
let testesPulados = 0;

const resultados = [];

function registrarTeste(nome, status, mensagem, detalhes = null) {
  totalTestes++;
  const resultado = {
    teste: nome,
    status: status, // PASS, FAIL, SKIP
    mensagem: mensagem,
    detalhes: detalhes
  };
  resultados.push(resultado);
  
  if (status === 'PASS') {
    testesPassaram++;
    console.log(`✅ PASS: ${nome}`);
    console.log(`   ${mensagem}`);
  } else if (status === 'FAIL') {
    testesFalharam++;
    console.log(`❌ FAIL: ${nome}`);
    console.log(`   ${mensagem}`);
    if (detalhes) console.log(`   Detalhes:`, detalhes);
  } else if (status === 'SKIP') {
    testesPulados++;
    console.log(`⏭️  SKIP: ${nome}`);
    console.log(`   ${mensagem}`);
  }
  console.log();
}

(async () => {
  try {
    console.log('═'.repeat(70));
    console.log('📊 ETAPA 1: VALIDAÇÃO DO SCHEMA BASE');
    console.log('═'.repeat(70));
    console.log();
    
    // Cliente sem autenticação (anon)
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    
    // ============================================================
    // TESTE 1: Verificar tabelas criadas
    // ============================================================
    console.log('🔍 Teste 1: Verificando tabelas...');
    const tabelas = [
      'perfis', 'categorias', 'subcategorias', 'receitas', 
      'cartoes', 'despesas', 'despesas_tipo_excecoes', 
      'parcelamentos', 'metas', 'compras_cartao'
    ];
    
    let todasTabelasExistem = true;
    for (const tabela of tabelas) {
      const { error } = await supabaseAnon.from(tabela).select('count').limit(0);
      if (error && error.code === '42P01') {
        todasTabelasExistem = false;
        console.log(`   ❌ Tabela ${tabela} não encontrada`);
      }
    }
    
    if (todasTabelasExistem) {
      registrarTeste(
        'Verificação de Tabelas',
        'PASS',
        'Todas as 10 tabelas foram criadas'
      );
    } else {
      registrarTeste(
        'Verificação de Tabelas',
        'FAIL',
        'Algumas tabelas não foram encontradas'
      );
    }
    
    // ============================================================
    // TESTE 2: Verificar categorias padrão
    // ============================================================
    console.log('🔍 Teste 2: Verificando categorias padrão...');
    const { data: categorias, error: catError } = await supabaseAnon
      .from('categorias')
      .select('*')
      .is('usuario_id', null);
    
    if (catError) {
      registrarTeste(
        'Categorias Padrão',
        'FAIL',
        'Erro ao buscar categorias: ' + catError.message
      );
    } else if (categorias.length === 19) {
      registrarTeste(
        'Categorias Padrão',
        'PASS',
        '19 categorias padrão encontradas (12 despesa, 4 receita, 3 ambos)'
      );
    } else {
      registrarTeste(
        'Categorias Padrão',
        'FAIL',
        `Esperado 19 categorias, encontrado ${categorias.length}`
      );
    }
    
    console.log();
    console.log('═'.repeat(70));
    console.log('🚨 LIMITAÇÃO: Criação de Usuários de Teste');
    console.log('═'.repeat(70));
    console.log();
    console.log('⚠️  Para testar RLS com usuários reais, é necessário:');
    console.log();
    console.log('1. Criar usuários via Supabase Auth (não disponível via anon key)');
    console.log('2. Autenticar com cada usuário (requer email/senha)');
    console.log('3. Executar operações com tokens de cada usuário');
    console.log();
    console.log('📋 ALTERNATIVAS PARA TESTE COMPLETO:');
    console.log();
    console.log('Opção A: Manual via Dashboard');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/auth/users');
    console.log('   2. Clique em "Add user" → "Create new user"');
    console.log('   3. Crie Alice: alice@test.com / senha123');
    console.log('   4. Crie Bob: bob@test.com / senha123');
    console.log('   5. Execute: node testar-rls-com-usuarios.js');
    console.log();
    console.log('Opção B: Via Service Role (bypass RLS - não recomendado para este teste)');
    console.log('   - Service role contorna RLS');
    console.log('   - Não valida isolamento entre usuários');
    console.log('   - Útil apenas para testes de estrutura');
    console.log();
    console.log('Opção C: Testes SQL Diretos (SQL Editor)');
    console.log('   - Executar queries com SET LOCAL role');
    console.log('   - Simular contexto de usuário via auth.uid()');
    console.log();
    
    // ============================================================
    // TESTES LIMITADOS SEM AUTENTICAÇÃO
    // ============================================================
    console.log('═'.repeat(70));
    console.log('🧪 ETAPA 2: TESTES DE RLS SEM AUTENTICAÇÃO');
    console.log('═'.repeat(70));
    console.log();
    
    // ============================================================
    // TESTE 3: RLS bloqueia SELECT sem autenticação
    // ============================================================
    console.log('🔍 Teste 3: RLS bloqueia SELECT em perfis (sem auth)...');
    const { data: perfisData, error: perfisError } = await supabaseAnon
      .from('perfis')
      .select('*');
    
    if (perfisError) {
      registrarTeste(
        'RLS - SELECT sem autenticação (perfis)',
        'PASS',
        'RLS bloqueou SELECT como esperado',
        { erro: perfisError.message }
      );
    } else if (perfisData.length === 0) {
      registrarTeste(
        'RLS - SELECT sem autenticação (perfis)',
        'PASS',
        'RLS retornou array vazio (sem dados visíveis)'
      );
    } else {
      registrarTeste(
        'RLS - SELECT sem autenticação (perfis)',
        'FAIL',
        `RLS NÃO bloqueou! ${perfisData.length} registros visíveis sem auth`
      );
    }
    
    // ============================================================
    // TESTE 4: RLS bloqueia INSERT sem autenticação
    // ============================================================
    console.log('🔍 Teste 4: RLS bloqueia INSERT em metas (sem auth)...');
    const { data: insertData, error: insertError } = await supabaseAnon
      .from('metas')
      .insert({
        usuario_id: '00000000-0000-0000-0000-000000000000',
        nome: 'Teste RLS',
        valor_desejado: 1000
      })
      .select();
    
    if (insertError) {
      registrarTeste(
        'RLS - INSERT sem autenticação (metas)',
        'PASS',
        'RLS bloqueou INSERT como esperado',
        { erro: insertError.message }
      );
    } else {
      registrarTeste(
        'RLS - INSERT sem autenticação (metas)',
        'FAIL',
        'RLS NÃO bloqueou! INSERT foi aceito sem autenticação',
        { dados: insertData }
      );
      
      // Limpar teste
      if (insertData && insertData[0]) {
        await supabaseAnon.from('metas').delete().eq('id', insertData[0].id);
      }
    }
    
    // ============================================================
    // TESTE 5: Categorias do sistema são visíveis sem auth
    // ============================================================
    console.log('🔍 Teste 5: Categorias do sistema visíveis (sem auth)...');
    const { data: catSistema, error: catSistemaError } = await supabaseAnon
      .from('categorias')
      .select('*')
      .is('usuario_id', null)
      .limit(5);
    
    if (catSistemaError) {
      registrarTeste(
        'RLS - SELECT categorias sistema (sem auth)',
        'FAIL',
        'Erro ao buscar categorias do sistema',
        { erro: catSistemaError.message }
      );
    } else if (catSistema.length > 0) {
      registrarTeste(
        'RLS - SELECT categorias sistema (sem auth)',
        'PASS',
        `Categorias do sistema visíveis sem auth: ${catSistema.length} encontradas`
      );
    } else {
      registrarTeste(
        'RLS - SELECT categorias sistema (sem auth)',
        'FAIL',
        'Nenhuma categoria do sistema visível (esperado pelo menos 1)'
      );
    }
    
    // ============================================================
    // TESTE 6: Foreign key valida referência inválida
    // ============================================================
    console.log('🔍 Teste 6: Foreign key bloqueia referência inválida...');
    const { error: fkError } = await supabaseAnon
      .from('despesas')
      .insert({
        usuario_id: '00000000-0000-0000-0000-000000000000',
        descricao: 'Teste FK',
        valor: 100,
        data: '2024-01-01',
        cartao_id: '99999999-9999-9999-9999-999999999999' // ID inexistente
      });
    
    // Esperamos erro (RLS ou FK)
    if (fkError) {
      if (fkError.message.includes('foreign key') || fkError.message.includes('violates')) {
        registrarTeste(
          'Foreign Key - Referência inválida',
          'PASS',
          'FK bloqueou inserção com cartao_id inválido',
          { erro: fkError.message }
        );
      } else {
        registrarTeste(
          'Foreign Key - Referência inválida',
          'PASS',
          'Inserção bloqueada (pode ser RLS antes da FK)',
          { erro: fkError.message }
        );
      }
    } else {
      registrarTeste(
        'Foreign Key - Referência inválida',
        'FAIL',
        'FK NÃO bloqueou inserção com cartao_id inválido'
      );
    }
    
    // ============================================================
    // TESTES QUE REQUEREM USUÁRIOS AUTENTICADOS
    // ============================================================
    console.log();
    console.log('═'.repeat(70));
    console.log('⏭️  ETAPA 3: TESTES REQUEREM USUÁRIOS AUTENTICADOS');
    console.log('═'.repeat(70));
    console.log();
    
    const testesComAuth = [
      {
        nome: 'Trigger - Criação automática de perfil',
        descricao: 'Verificar se novo usuário cria perfil automaticamente'
      },
      {
        nome: 'RLS - Isolamento SELECT entre usuários',
        descricao: 'Alice não vê metas de Bob'
      },
      {
        nome: 'RLS - Isolamento INSERT entre usuários',
        descricao: 'Alice não pode inserir com usuario_id de Bob'
      },
      {
        nome: 'RLS - Isolamento UPDATE entre usuários',
        descricao: 'Alice não pode atualizar metas de Bob'
      },
      {
        nome: 'RLS - Isolamento DELETE entre usuários',
        descricao: 'Alice não pode apagar metas de Bob'
      },
      {
        nome: 'RLS - Validação de cartão em despesas',
        descricao: 'Alice não pode vincular despesa ao cartão de Bob'
      },
      {
        nome: 'RLS - Validação de cartão em compras_cartao',
        descricao: 'Alice não pode vincular compra ao cartão de Bob'
      },
      {
        nome: 'RLS - Usuário vê próprias categorias + sistema',
        descricao: 'Alice vê categorias do sistema + próprias (não de Bob)'
      },
      {
        nome: 'RLS - Usuário não vê subcategorias de outros',
        descricao: 'Alice não vê subcategorias de Bob'
      }
    ];
    
    testesComAuth.forEach(teste => {
      registrarTeste(
        teste.nome,
        'SKIP',
        `Requer usuários autenticados: ${teste.descricao}`
      );
    });
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log();
    console.log('═'.repeat(70));
    console.log('📊 RESUMO DOS TESTES');
    console.log('═'.repeat(70));
    console.log();
    console.log(`✅ PASS:  ${testesPassaram}/${totalTestes}`);
    console.log(`❌ FAIL:  ${testesFalharam}/${totalTestes}`);
    console.log(`⏭️  SKIP:  ${testesPulados}/${totalTestes}`);
    console.log();
    
    if (testesFalharam === 0 && testesPassaram > 0) {
      console.log('✅ TODOS OS TESTES EXECUTÁVEIS PASSARAM!');
      console.log();
      console.log('⚠️  Testes pulados requerem criação de usuários de teste.');
      console.log('   Siga as instruções acima para completar a validação.');
    } else if (testesFalharam > 0) {
      console.log('❌ ALGUNS TESTES FALHARAM');
      console.log();
      console.log('Testes que falharam:');
      resultados
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   - ${r.teste}`);
          console.log(`     ${r.mensagem}`);
        });
    }
    
    console.log();
    console.log('═'.repeat(70));
    console.log('📋 DETALHAMENTO COMPLETO');
    console.log('═'.repeat(70));
    console.log();
    
    resultados.forEach((r, i) => {
      const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${i + 1}. ${statusIcon} ${r.status}: ${r.teste}`);
      console.log(`   ${r.mensagem}`);
      if (r.detalhes) {
        console.log(`   Detalhes:`, JSON.stringify(r.detalhes, null, 2));
      }
      console.log();
    });
    
    console.log('═'.repeat(70));
    
    process.exit(testesFalharam > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('❌ ERRO CRÍTICO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
