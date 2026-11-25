/**
 * VALIDAÇÃO DE SINTAXE SQL - 01_EXECUTAR_SCHEMA_BASE.sql
 * Verifica estrutura sem executar no banco
 */

import { readFileSync } from 'fs';

const SQL_FILE = '01_EXECUTAR_SCHEMA_BASE.sql';

console.log('🔍 Validando sintaxe do arquivo:', SQL_FILE);
console.log('═'.repeat(60));

try {
  const sql = readFileSync(SQL_FILE, 'utf-8');
  
  // Contadores
  const tables = (sql.match(/CREATE TABLE IF NOT EXISTS public\.\w+/g) || []).length;
  const policies = (sql.match(/CREATE POLICY/g) || []).length;
  const indexes = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
  const triggers = (sql.match(/CREATE OR REPLACE TRIGGER/g) || []).length;
  const functions = (sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
  const inserts = (sql.match(/INSERT INTO public\.categorias/g) || []).length;
  const categoryRows = (sql.match(/\(NULL,/g) || []).length;

  // Verificar dependências
  const hasSubcategorias = sql.includes('CREATE TABLE IF NOT EXISTS public.subcategorias');
  const comprasCartaoReferencesSubcategorias = sql.includes('REFERENCES public.subcategorias(id)');
  
  console.log('\n📊 ESTATÍSTICAS:');
  console.log('─'.repeat(60));
  console.log(`✓ Tabelas criadas:           ${tables}`);
  console.log(`✓ Políticas RLS:             ${policies}`);
  console.log(`✓ Índices:                   ${indexes}`);
  console.log(`✓ Triggers:                  ${triggers}`);
  console.log(`✓ Functions:                 ${functions}`);
  console.log(`✓ Comandos INSERT:           ${inserts}`);
  console.log(`✓ Categorias padrão:         ${categoryRows}`);
  
  console.log('\n🔗 VERIFICAÇÃO DE DEPENDÊNCIAS:');
  console.log('─'.repeat(60));
  
  // Lista de tabelas esperadas
  const expectedTables = [
    'perfis',
    'categorias',
    'subcategorias',
    'receitas',
    'despesas',
    'despesas_tipo_excecoes',
    'parcelamentos',
    'metas',
    'cartoes',
    'compras_cartao'
  ];
  
  let missingTables = [];
  expectedTables.forEach(table => {
    if (sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`)) {
      console.log(`✅ Tabela ${table.padEnd(25)} - ENCONTRADA`);
    } else {
      console.log(`❌ Tabela ${table.padEnd(25)} - FALTA`);
      missingTables.push(table);
    }
  });
  
  console.log('\n🔐 VERIFICAÇÃO DE FOREIGN KEYS:');
  console.log('─'.repeat(60));
  
  if (hasSubcategorias && comprasCartaoReferencesSubcategorias) {
    console.log('✅ compras_cartao → subcategorias (FK válida)');
  } else if (!hasSubcategorias && comprasCartaoReferencesSubcategorias) {
    console.log('❌ compras_cartao referencia subcategorias mas tabela não é criada!');
  } else {
    console.log('⚠️  Nenhuma referência a subcategorias encontrada');
  }
  
  // Verificar ordem de criação (subcategorias antes de compras_cartao)
  const subcategoriasPos = sql.indexOf('CREATE TABLE IF NOT EXISTS public.subcategorias');
  const comprasCartaoPos = sql.indexOf('CREATE TABLE IF NOT EXISTS public.compras_cartao');
  
  if (subcategoriasPos > 0 && comprasCartaoPos > 0) {
    if (subcategoriasPos < comprasCartaoPos) {
      console.log('✅ Ordem de criação correta (subcategorias antes de compras_cartao)');
    } else {
      console.log('❌ ERRO: compras_cartao criada antes de subcategorias!');
    }
  }
  
  console.log('\n📋 VERIFICAÇÃO DE RLS:');
  console.log('─'.repeat(60));
  
  expectedTables.forEach(table => {
    const hasEnableRLS = sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    const hasPolicies = new RegExp(`CREATE POLICY.*ON public\\.${table}`, 'g').test(sql);
    
    if (hasEnableRLS && hasPolicies) {
      console.log(`✅ ${table.padEnd(25)} - RLS habilitado + policies criadas`);
    } else if (hasEnableRLS && !hasPolicies) {
      console.log(`⚠️  ${table.padEnd(25)} - RLS habilitado mas SEM policies`);
    } else if (!hasEnableRLS) {
      console.log(`❌ ${table.padEnd(25)} - RLS NÃO habilitado`);
    }
  });
  
  console.log('\n🎯 VALIDAÇÃO FINAL:');
  console.log('═'.repeat(60));
  
  const isValid = 
    tables === 10 &&
    policies === 21 &&
    categoryRows === 19 &&
    hasSubcategorias &&
    comprasCartaoReferencesSubcategorias &&
    subcategoriasPos < comprasCartaoPos &&
    missingTables.length === 0;
  
  if (isValid) {
    console.log('✅ ARQUIVO SQL VÁLIDO E COMPLETO');
    console.log('✅ Todas as 10 tabelas estão presentes (incluindo subcategorias)');
    console.log('✅ Todas as 21 políticas RLS estão criadas');
    console.log('✅ Todas as 19 categorias padrão serão inseridas');
    console.log('✅ Dependência subcategorias → compras_cartao corrigida');
    console.log('✅ Ordem de criação respeitada');
    console.log('\n🚀 PRONTO PARA EXECUTAR NO SUPABASE DEV');
  } else {
    console.log('❌ ARQUIVO SQL INCOMPLETO OU COM ERROS');
    if (tables !== 10) console.log(`   - Esperado 10 tabelas, encontradas ${tables}`);
    if (policies !== 21) console.log(`   - Esperado 21 policies, encontradas ${policies}`);
    if (categoryRows !== 19) console.log(`   - Esperado 19 categorias, encontradas ${categoryRows}`);
    if (!hasSubcategorias) console.log('   - Tabela subcategorias não criada');
    if (missingTables.length > 0) console.log(`   - Tabelas faltando: ${missingTables.join(', ')}`);
    console.log('\n⚠️  CORRIGIR ANTES DE EXECUTAR');
  }
  
  console.log('═'.repeat(60));
  
  if (!isValid) {
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ ERRO ao ler arquivo:', error.message);
  process.exit(1);
}
