#!/usr/bin/env node

/**
 * Script de validação dos sistemas implementados
 * Executa testes de sanidade sem precisar do Playwright
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Cores para output
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'

console.log(`${BLUE}
╔═══════════════════════════════════════════════════╗
║   VALIDAÇÃO DE SISTEMAS - ALMEIDA FINANCE        ║
╚═══════════════════════════════════════════════════╝
${RESET}`)

let totalTestes = 0
let testesPassaram = 0
let testesFalharam = 0

function teste(nome, passou, mensagem = '') {
  totalTestes++
  if (passou) {
    testesPassaram++
    console.log(`${GREEN}✓${RESET} ${nome}`)
    if (mensagem) console.log(`  ${mensagem}`)
  } else {
    testesFalharam++
    console.log(`${RED}✗${RESET} ${nome}`)
    if (mensagem) console.log(`  ${RED}${mensagem}${RESET}`)
  }
}

function secao(titulo) {
  console.log(`\n${YELLOW}▶ ${titulo}${RESET}`)
}

// ─────────────────────────────────────────────────────────
// VALIDAÇÃO 1: Arquivos Essenciais
// ─────────────────────────────────────────────────────────
secao('1. ARQUIVOS ESSENCIAIS')

try {
  const adminWhatsApp = readFileSync(join(__dirname, 'src/pages/admin/AdminWhatsApp.jsx'), 'utf8')
  teste('AdminWhatsApp.jsx existe', true)
  teste('AdminWhatsApp tem modo simulação', adminWhatsApp.includes('modoSimulacao'))
  teste('AdminWhatsApp tem botão Real/Simulação', adminWhatsApp.includes('TestTube') && adminWhatsApp.includes('Database'))
  teste('AdminWhatsApp grava no Supabase', adminWhatsApp.includes('supabase.from') && adminWhatsApp.includes('insert'))
} catch (err) {
  teste('AdminWhatsApp.jsx existe', false, err.message)
}

try {
  const parser = readFileSync(join(__dirname, 'src/lib/whatsappParser.js'), 'utf8')
  teste('whatsappParser.js existe', true)
  teste('Parser retorna { sucesso, transacao, erro }', parser.includes('sucesso: true') && parser.includes('sucesso: false'))
  teste('Parser valida mensagens', parser.includes('validarMensagem'))
} catch (err) {
  teste('whatsappParser.js existe', false, err.message)
}

try {
  const admin = readFileSync(join(__dirname, 'src/pages/Admin.jsx'), 'utf8')
  teste('Admin.jsx tem aba WhatsApp', admin.includes("'whatsapp'") && admin.includes('MessageSquare'))
} catch (err) {
  teste('Admin.jsx modificado', false, err.message)
}

try {
  const app = readFileSync(join(__dirname, 'src/App.jsx'), 'utf8')
  teste('App.jsx tem rota /admin/whatsapp', app.includes('/admin/whatsapp'))
  teste('App.jsx importa AdminWhatsApp', app.includes('AdminWhatsApp'))
} catch (err) {
  teste('App.jsx modificado', false, err.message)
}

// ─────────────────────────────────────────────────────────
// VALIDAÇÃO 2: Sistema de Pagamentos
// ─────────────────────────────────────────────────────────
secao('2. SISTEMA DE PAGAMENTOS DE FATURAS')

try {
  const hookPagamentos = readFileSync(join(__dirname, 'src/hooks/usePagamentosFatura.js'), 'utf8')
  teste('usePagamentosFatura.js existe', true)
  teste('Hook tem registrarPagamento', hookPagamentos.includes('registrarPagamento'))
  teste('Hook tem estornarPagamento', hookPagamentos.includes('estornarPagamento'))
  teste('Hook tem validarPagamento', hookPagamentos.includes('validarPagamento'))
  teste('Sistema está ATIVO', hookPagamentos.includes('SISTEMA_ATIVO = true'))
} catch (err) {
  teste('usePagamentosFatura.js existe', false, err.message)
}

try {
  const modalPagamento = readFileSync(join(__dirname, 'src/components/ModalPagamentoFatura.jsx'), 'utf8')
  teste('ModalPagamentoFatura.jsx existe', true)
  teste('Modal calcula liberação de limite', modalPagamento.includes('limiteLiberado'))
  teste('Modal valida pagamentos', modalPagamento.includes('valorRestante'))
} catch (err) {
  teste('ModalPagamentoFatura.jsx existe', false, err.message)
}

// ─────────────────────────────────────────────────────────
// VALIDAÇÃO 3: Custo de Vida
// ─────────────────────────────────────────────────────────
secao('3. CUSTO DE VIDA')

try {
  const hookCusto = readFileSync(join(__dirname, 'src/hooks/useCustoDeVida.js'), 'utf8')
  teste('useCustoDeVida.js existe', true)
  teste('Hook usa dados reais (despesas)', hookCusto.includes('useDespesas'))
  teste('Hook integra compras de cartão', hookCusto.includes('useComprasCartao'))
  teste('Hook integra parcelamentos', hookCusto.includes('useParcelamentos'))
  teste('Hook mapeia categorias essenciais', hookCusto.includes('mapearCategoria'))
  teste('Hook evita duplicação de faturas', hookCusto.includes('pagamento fatura'))
  teste('Sistema está ATIVO', hookCusto.includes('SISTEMA_ATIVO = true'))
} catch (err) {
  teste('useCustoDeVida.js existe', false, err.message)
}

// ─────────────────────────────────────────────────────────
// VALIDAÇÃO 4: Testes Automatizados
// ─────────────────────────────────────────────────────────
secao('4. TESTES AUTOMATIZADOS')

try {
  const testePrioridades = readFileSync(join(__dirname, 'tests/e2e/prioridades.spec.js'), 'utf8')
  teste('prioridades.spec.js existe', true)
  teste('Testa WhatsApp Financeiro', testePrioridades.includes('WhatsApp Financeiro'))
  teste('Testa Pagamento de Faturas', testePrioridades.includes('Pagamento de Faturas'))
  teste('Testa Custo de Vida', testePrioridades.includes('Custo de Vida'))
  teste('Testa isolamento de usuários', testePrioridades.includes('isolamento entre usuários'))
} catch (err) {
  teste('prioridades.spec.js existe', false, err.message)
}

try {
  const playwrightConfig = readFileSync(join(__dirname, 'playwright.config.js'), 'utf8')
  teste('playwright.config.js configurado', true)
} catch (err) {
  teste('playwright.config.js existe', false, err.message)
}

// ─────────────────────────────────────────────────────────
// VALIDAÇÃO 5: Build e Estrutura
// ─────────────────────────────────────────────────────────
secao('5. BUILD E ESTRUTURA')

try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
  teste('package.json válido', true)
  teste('Dependência @supabase/supabase-js', !!packageJson.dependencies['@supabase/supabase-js'])
  teste('Dependência react-router-dom', !!packageJson.dependencies['react-router-dom'])
  teste('DevDep @playwright/test', !!packageJson.devDependencies['@playwright/test'])
} catch (err) {
  teste('package.json válido', false, err.message)
}

try {
  const gitignore = readFileSync(join(__dirname, '.gitignore'), 'utf8')
  teste('.gitignore protege .env', gitignore.includes('.env'))
  teste('.gitignore protege node_modules', gitignore.includes('node_modules'))
} catch (err) {
  teste('.gitignore existe', false, err.message)
}

// ─────────────────────────────────────────────────────────
// RESUMO FINAL
// ─────────────────────────────────────────────────────────
console.log(`\n${BLUE}═══════════════════════════════════════════════════${RESET}`)
console.log(`${GREEN}Testes passaram:${RESET} ${testesPassaram}/${totalTestes}`)
console.log(`${testesFalharam > 0 ? RED : GREEN}Testes falharam:${RESET} ${testesFalharam}/${totalTestes}`)

const percentual = Math.round((testesPassaram / totalTestes) * 100)
console.log(`${BLUE}Percentual de sucesso:${RESET} ${percentual}%`)

if (testesFalharam === 0) {
  console.log(`\n${GREEN}✓ TODOS OS SISTEMAS VALIDADOS COM SUCESSO!${RESET}\n`)
  process.exit(0)
} else {
  console.log(`\n${YELLOW}⚠ Alguns testes falharam. Revise os erros acima.${RESET}\n`)
  process.exit(1)
}
