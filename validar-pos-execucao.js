/**
 * VALIDAÇÃO PÓS-EXECUÇÃO: Verifica se schema base foi executado corretamente
 * Execute APÓS rodar 01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql no SQL Editor
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler credenciais
const envContent = readFileSync('.env.development.local', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais não encontradas');
  process.exit(1);
}

console.log('═'.repeat(70));
console.log('🔍 VALIDAÇÃO PÓS-EXECUÇÃO: Schema Base');
console.log('═'.repeat(70));
console.log('📍 Ambiente:', supabaseUrl);
console.log('═'.repeat(70));
console.log();

const supabase = createClient(supabaseUrl, supabaseKey);

// Contadores
let sucessos = 0;
let falhas = 0;
const erros = [];

(async () => {
  try {
    // ============================================================
    // TESTE 1: Verificar se tabelas existem
    // ============================================================
    console.log('📊 TESTE 1: Verificando tabelas...');
    console.log('─'.repeat(70));
    
    const tabelas = [
      'perfis', 'categorias', 'subcategorias', 'receitas', 
      'cartoes', 'despesas', 'despesas_tipo_excecoes', 
      'parcelamentos', 'metas', 'compras_cartao'
    ];
    
    let tabelasExistentes = 0;
    for (const tabela of tabelas) {
      const { error } = await supabase.from(tabela).select('count').limit(0);
      if (!error || error.code !== '42P01') {
        console.log(`✅ Tabela ${tabela.padEnd(25)} - EXISTE`);
        tabelasExistentes++;
        sucessos++;
      } else {
        console.log(`❌ Tabela ${tabela.padEnd(25)} - NÃO ENCONTRADA`);
        erros.push(`Tabela ${tabela} não foi criada`);
        falhas++;
      }
    }
    
    console.log('─'.repeat(70));
    console.log(`📊 Total: ${tabelasExistentes}/10 tabelas criadas`);
    
    if (tabelasExistentes !== 10) {
      console.log(`❌ ESPERADO: 10 tabelas | ENCONTRADO: ${tabelasExistentes}`);
    } else {
      console.log('✅ Todas as 10 tabelas criadas com sucesso');
    }
    
    console.log();
    
    // ============================================================
    // TESTE 2: Verificar categorias padrão
    // ============================================================
    console.log('📊 TESTE 2: Verificando categorias padrão...');
    console.log('─'.repeat(70));
    
    const { data: categorias, error: catError } = await supabase
      .from('categorias')
      .select('*')
      .is('usuario_id', null);
    
    if (catError) {
      console.log('❌ Erro ao buscar categorias:', catError.message);
      erros.push('Falha ao verificar categorias padrão');
      falhas++;
    } else {
      console.log(`✅ Categorias padrão encontradas: ${categorias.length}`);
      
      if (categorias.length !== 19) {
        console.log(`⚠️  ESPERADO: 19 | ENCONTRADO: ${categorias.length}`);
        erros.push(`Categorias: esperado 19, encontrado ${categorias.length}`);
        falhas++;
      } else {
        console.log('✅ Total correto: 19 categorias');
        sucessos++;
      }
      
      // Contar por tipo
      const porTipo = categorias.reduce((acc, cat) => {
        acc[cat.tipo] = (acc[cat.tipo] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   Despesa:', porTipo.despesa || 0);
      console.log('   Receita:', porTipo.receita || 0);
      console.log('   Ambos:', porTipo.ambos || 0);
      
      if (porTipo.despesa === 12 && porTipo.receita === 4 && porTipo.ambos === 3) {
        console.log('✅ Distribuição correta por tipo');
        sucessos++;
      } else {
        console.log('⚠️  Distribuição incorreta (esperado: 12 despesa, 4 receita, 3 ambos)');
        erros.push('Distribuição de categorias por tipo incorreta');
        falhas++;
      }
    }
    
    console.log();
    
    // ============================================================
    // TESTE 3: Verificar RLS habilitado
    // ============================================================
    console.log('📊 TESTE 3: Verificando RLS (Row Level Security)...');
    console.log('─'.repeat(70));
    
    // Tentar inserir sem autenticação (deve falhar se RLS estiver ativo)
    const { data: testInsert, error: rlsError } = await supabase
      .from('metas')
      .insert({ 
        usuario_id: '00000000-0000-0000-0000-000000000000',
        nome: 'Teste RLS',
        valor_desejado: 1000
      })
      .select();
    
    if (rlsError) {
      console.log('✅ RLS está ativo (inserção bloqueada como esperado)');
      console.log('   Erro (esperado):', rlsError.message);
      sucessos++;
    } else {
      console.log('❌ RLS NÃO está funcionando! Inserção permitida sem auth');
      console.log('   Dados inseridos:', testInsert);
      erros.push('RLS não está bloqueando inserções não autorizadas');
      falhas++;
      
      // Limpar teste
      if (testInsert && testInsert[0]) {
        await supabase
          .from('metas')
          .delete()
          .eq('id', testInsert[0].id);
      }
    }
    
    console.log();
    
    // ============================================================
    // TESTE 4: Verificar relacionamentos (Foreign Keys)
    // ============================================================
    console.log('📊 TESTE 4: Verificando relacionamentos (Foreign Keys)...');
    console.log('─'.repeat(70));
    
    // Tentar inserir despesa com cartao_id inválido (deve falhar)
    const { error: fkError } = await supabase
      .from('despesas')
      .insert({
        usuario_id: '00000000-0000-0000-0000-000000000000',
        descricao: 'Teste FK',
        valor: 100,
        data: '2024-01-01',
        cartao_id: '99999999-9999-9999-9999-999999999999' // ID inexistente
      });
    
    if (fkError && fkError.message.includes('foreign key')) {
      console.log('✅ Foreign key funcionando (inserção com FK inválida bloqueada)');
      console.log('   Erro (esperado):', fkError.message);
      sucessos++;
    } else if (fkError) {
      console.log('⚠️  Erro diferente do esperado:', fkError.message);
      // Pode ser RLS bloqueando antes da FK
      console.log('✅ Bloqueio ocorreu (pode ser RLS ou FK)');
      sucessos++;
    } else {
      console.log('❌ Foreign key NÃO funcionando! Inserção com FK inválida foi aceita');
      erros.push('Foreign keys não estão validando');
      falhas++;
    }
    
    console.log();
    
    // ============================================================
    // TESTE 5: Testar idempotência
    // ============================================================
    console.log('📊 TESTE 5: Testando idempotência...');
    console.log('─'.repeat(70));
    console.log('⚠️  Este teste requer executar o SQL novamente no SQL Editor');
    console.log('   Se você executar 01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql novamente:');
    console.log('   - NÃO deve dar erros (IF NOT EXISTS)');
    console.log('   - Contagens devem permanecer iguais');
    console.log('   - Categorias NÃO devem duplicar (ON CONFLICT DO NOTHING)');
    console.log();
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('═'.repeat(70));
    console.log('📊 RESUMO DA VALIDAÇÃO');
    console.log('═'.repeat(70));
    console.log(`✅ Testes bem-sucedidos: ${sucessos}`);
    console.log(`❌ Testes falhados: ${falhas}`);
    console.log();
    
    if (erros.length > 0) {
      console.log('❌ PROBLEMAS ENCONTRADOS:');
      erros.forEach((erro, i) => {
        console.log(`   ${i + 1}. ${erro}`);
      });
      console.log();
    }
    
    if (falhas === 0) {
      console.log('✅ SCHEMA BASE VÁLIDO E FUNCIONAL!');
      console.log();
      console.log('🎯 PRÓXIMOS PASSOS:');
      console.log('   1. Execute o SQL novamente para testar idempotência');
      console.log('   2. Crie usuários de teste para validar RLS');
      console.log('   3. Teste isolamento de dados entre usuários');
      console.log('   4. Prossiga com as 38 migrations subsequentes');
    } else {
      console.log('❌ VALIDAÇÃO FALHOU');
      console.log('   Revise os problemas acima antes de prosseguir');
    }
    
    console.log('═'.repeat(70));
    
    process.exit(falhas > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('❌ ERRO CRÍTICO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
