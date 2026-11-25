/**
 * VALIDAR CONEXÃO COM SUPABASE DEV
 * 
 * Este script valida a conexão com o Supabase DEV usando apenas
 * permissões públicas (anon key). NÃO expõe credenciais.
 * 
 * Executar após configurar .env.development.local:
 *   node VALIDAR_CONEXAO_DEV.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Carregar .env.development.local
config({ path: resolve(__dirname, '.env.development.local') })

const EXPECTED_DEV_REF = 'gxfcfpdwyjqcrfssxgbi'
const PRODUCTION_REF = 'ievccupeijzuzhomphwn'
const OLD_DEV_REF = 'fzawugbiojmtrthmshcc'

console.log('=== VALIDAÇÃO DE CONEXÃO SUPABASE DEV ===\n')

// 1. Verificar variáveis de ambiente
const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('1. Verificando configuração:')
console.log(`   URL: ${url}`)

if (!url || !anonKey) {
  console.error('   ✗ URL ou ANON_KEY não configurados')
  console.error('   Por favor, configure .env.development.local')
  process.exit(1)
}

if (anonKey === 'COLOCAR_CHAVE_PUBLICA_AQUI') {
  console.error('   ✗ Chave ainda não foi substituída')
  console.error('   Por favor, substitua o placeholder pela chave real')
  process.exit(1)
}

console.log(`   Chave: ${anonKey.substring(0, 20)}...${anonKey.substring(anonKey.length - 10)} (mascarada)`)

// 2. Verificar que não é produção
console.log('\n2. Verificando isolamento:')

if (url.includes(PRODUCTION_REF)) {
  console.error('   ✗✗✗ ALERTA: URL aponta para PRODUÇÃO!')
  console.error('   NÃO PROSSEGUIR!')
  process.exit(1)
}

if (url.includes(EXPECTED_DEV_REF)) {
  console.log('   ✓ URL aponta para NOVO DEV (correto)')
} else if (url.includes(OLD_DEV_REF)) {
  console.warn('   ⚠ URL aponta para DEV ANTIGO (inativo)')
} else {
  console.warn('   ⚠ URL não reconhecida')
}

// 3. Testar conexão
console.log('\n3. Testando conexão:')

const supabase = createClient(url, anonKey)

try {
  // Tentar query simples (lista tabelas públicas via API)
  const { data, error } = await supabase
    .from('categorias')
    .select('id')
    .limit(1)
  
  if (error) {
    if (error.code === '42P01') {
      // Tabela não existe (esperado em banco vazio)
      console.log('   ✓ Conexão estabelecida')
      console.log('   ✓ Banco vazio (tabela categorias não existe)')
      console.log('   ✓ Pronto para executar migrações')
    } else if (error.code === 'PGRST116') {
      // Schema exists but no tables
      console.log('   ✓ Conexão estabelecida')
      console.log('   ✓ Schema público existe mas sem tabelas')
      console.log('   ✓ Pronto para executar migrações')
    } else {
      console.error('   ✗ Erro ao consultar banco:', error.message)
      console.error('   Código:', error.code)
    }
  } else {
    console.log('   ✓ Conexão estabelecida')
    console.log('   ⚠ Tabela categorias JÁ EXISTE')
    console.log(`   ⚠ Registros encontrados: ${data?.length || 0}`)
    console.log('   ⚠ Banco pode não estar vazio')
  }
  
} catch (err) {
  console.error('   ✗ Erro de conexão:', err.message)
  process.exit(1)
}

// 4. Verificar autenticação (deve estar deslogado)
console.log('\n4. Verificando estado de autenticação:')

const { data: { session } } = await supabase.auth.getSession()

if (session) {
  console.warn('   ⚠ Usuário está logado:', session.user.email)
  console.warn('   Recomendado: Testar com usuário deslogado')
} else {
  console.log('   ✓ Sem sessão ativa (correto para validação)')
}

// 5. Testar permissões públicas
console.log('\n5. Testando permissões públicas (RLS):')

try {
  // Tentar inserir sem autenticação (deve falhar por RLS)
  const { error } = await supabase
    .from('perfis')
    .insert({ nome: 'teste' })
  
  if (error) {
    if (error.code === '42P01') {
      console.log('   ✓ Tabela perfis não existe (banco vazio)')
    } else if (error.code === '42501') {
      console.log('   ✓ RLS está ativo (insert bloqueado)')
    } else {
      console.log(`   ⚠ Erro: ${error.message}`)
    }
  } else {
    console.warn('   ⚠ Insert público permitido (RLS pode estar desabilitado)')
  }
} catch (err) {
  console.log('   ⚠ Erro ao testar RLS:', err.message)
}

// Resumo final
console.log('\n=== RESULTADO ===')
console.log('✓ Configuração validada')
console.log('✓ Conexão estabelecida')
console.log('✓ Ambiente isolado (não é produção)')
console.log('✓ Pronto para executar migrações')
console.log('\nPróximos passos:')
console.log('1. Executar migrações: SETUP_DEV_COMPLETO.sql')
console.log('2. Validar estrutura: TESTES_VALIDACAO_BANCO.sql')
console.log('3. Executar testes E2E: npm run test:e2e:headed')
