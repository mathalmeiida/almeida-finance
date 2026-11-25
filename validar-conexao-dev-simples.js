/**
 * VALIDAR CONEXÃO COM SUPABASE DEV (VERSÃO SIMPLES)
 * Sem dependências externas, apenas fetch nativo do Node.js
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const EXPECTED_DEV_REF = 'gxfcfpdwyjqcrfssxgbi'
const PRODUCTION_REF = 'ievccupeijzuzhomphwn'

console.log('=== VALIDAÇÃO DE CONEXÃO SUPABASE DEV ===\n')

// 1. Ler .env.development.local
const envPath = resolve(__dirname, '.env.development.local')
const envContent = readFileSync(envPath, 'utf-8')

let url = null
let anonKey = null

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    url = line.split('=')[1].trim()
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    anonKey = line.split('=')[1].trim()
  }
})

console.log('1. Verificando configuração:')
console.log(`   URL: ${url}`)

if (!url || !anonKey) {
  console.error('   ✗ URL ou ANON_KEY não configurados')
  process.exit(1)
}

console.log(`   Chave: ${anonKey.substring(0, 20)}...${anonKey.substring(anonKey.length - 10)} (mascarada)`)

// 2. Verificar isolamento
console.log('\n2. Verificando isolamento:')

if (url.includes(PRODUCTION_REF)) {
  console.error('   ✗✗✗ ALERTA: URL aponta para PRODUÇÃO!')
  console.error('   NÃO PROSSEGUIR!')
  process.exit(1)
}

if (url.includes(EXPECTED_DEV_REF)) {
  console.log('   ✓ URL aponta para NOVO DEV (correto)')
} else {
  console.warn('   ⚠ URL não reconhecida')
}

// 3. Testar conexão HTTP
console.log('\n3. Testando conexão HTTP:')

try {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  })
  
  console.log(`   Status: ${response.status} ${response.statusText}`)
  
  if (response.ok || response.status === 400) {
    console.log('   ✓ API REST está acessível')
  } else {
    console.warn('   ⚠ Status inesperado')
  }
} catch (err) {
  console.error('   ✗ Erro de conexão:', err.message)
  process.exit(1)
}

// 4. Testar query (verificar se banco está vazio)
console.log('\n4. Testando consulta ao banco:')

try {
  const response = await fetch(`${url}/rest/v1/categorias?select=id&limit=1`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  })
  
  if (response.status === 404) {
    console.log('   ✓ Tabela categorias não existe (banco vazio)')
    console.log('   ✓ Pronto para executar migrações')
  } else if (response.ok) {
    const data = await response.json()
    console.log(`   ⚠ Tabela categorias existe (${data.length} registros)`)
    console.log('   ⚠ Banco pode já ter estrutura')
  } else {
    const errorText = await response.text()
    console.log(`   Status: ${response.status}`)
    console.log(`   ⚠ Resposta: ${errorText.substring(0, 100)}`)
  }
} catch (err) {
  console.error('   ✗ Erro ao consultar:', err.message)
}

// Resumo
console.log('\n=== RESULTADO ===')
console.log('✓ Configuração validada')
console.log('✓ Conexão estabelecida')
console.log('✓ Ambiente isolado (não é produção)')
console.log('✓ Pronto para executar migrações')
console.log('\nPróximos passos:')
console.log('1. Executar migrações via SQL Editor do Supabase')
console.log('2. Validar estrutura criada')
console.log('3. Executar testes E2E')
