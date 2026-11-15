// @ts-check
import { test, expect } from '@playwright/test'

/**
 * TESTE DE DIAGNÓSTICO - Página Investimentos
 * 
 * Objetivo: Capturar o erro EXATO que está ocorrendo em produção
 * 
 * Este teste:
 * 1. Captura TODOS os erros JavaScript
 * 2. Captura TODOS os console.error
 * 3. Captura o stack trace completo
 * 4. Tenta acessar a página sem autenticação (para ver erro básico)
 * 5. Captura o estado do DOM quando erro ocorre
 */

test.describe('DIAGNÓSTICO: Página Investimentos', () => {
  let consoleMessages = []
  let consoleErrors = []
  let pageErrors = []

  test.beforeEach(async ({ page }) => {
    consoleMessages = []
    consoleErrors = []
    pageErrors = []

    // Capturar TODOS os console.log
    page.on('console', msg => {
      const text = msg.text()
      consoleMessages.push({
        type: msg.type(),
        text,
        location: msg.location(),
      })
      
      if (msg.type() === 'error') {
        consoleErrors.push({
          text,
          location: msg.location(),
          args: msg.args(),
        })
      }
      
      console.log(`[Browser ${msg.type().toUpperCase()}]`, text)
    })

    // Capturar erros de página (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      console.error('🔴 [PAGE ERROR]', error.message)
      console.error('Stack:', error.stack)
    })
  })

  test('deve capturar erro exato ao acessar /investimentos', async ({ page }) => {
    console.log('\n=== INICIANDO TESTE DE DIAGNÓSTICO ===\n')

    // Tentar acessar a página diretamente
    console.log('Acessando http://localhost:5173/investimentos')
    
    const response = await page.goto('http://localhost:5173/investimentos', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    }).catch(e => {
      console.error('Erro ao navegar:', e.message)
      return null
    })

    if (response) {
      console.log('Status HTTP:', response.status())
    }

    // Aguardar um pouco para capturar erros
    await page.waitForTimeout(3000)

    // Capturar HTML atual
    const html = await page.content()
    const hasErrorBoundary = html.includes('Algo deu errado')
    const hasInvestimentosContent = html.includes('Investimentos') && html.includes('patrimônio')

    console.log('\n=== ANÁLISE DO DOM ===')
    console.log('Tem ErrorBoundary ativa?', hasErrorBoundary)
    console.log('Tem conteúdo de Investimentos?', hasInvestimentosContent)

    // Tentar capturar erro do localStorage
    const lastError = await page.evaluate(() => {
      const stored = localStorage.getItem('lastError')
      return stored ? JSON.parse(stored) : null
    }).catch(() => null)

    if (lastError) {
      console.log('\n=== ERRO CAPTURADO DO LOCALSTORAGE ===')
      console.log('Mensagem:', lastError.message)
      console.log('Timestamp:', lastError.timestamp)
      console.log('Stack:', lastError.stack)
      console.log('Component Stack:', lastError.componentStack)
    }

    // Resumo dos erros capturados
    console.log('\n=== RESUMO DOS ERROS ===')
    console.log('Total de console.error:', consoleErrors.length)
    console.log('Total de pageError:', pageErrors.length)
    console.log('Total de mensagens:', consoleMessages.length)

    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===')
      consoleErrors.forEach((err, i) => {
        console.log(`\nErro ${i + 1}:`, err.text)
        console.log('Localização:', err.location)
      })
    }

    if (pageErrors.length > 0) {
      console.log('\n=== PAGE ERRORS ===')
      pageErrors.forEach((err, i) => {
        console.log(`\nErro ${i + 1}:`)
        console.log('Tipo:', err.name)
        console.log('Mensagem:', err.message)
        console.log('Stack:', err.stack)
      })
    }

    // Buscar por mensagens específicas do componente
    const investimentosLogs = consoleMessages.filter(m => 
      m.text.includes('[Investimentos]') || m.text.includes('[ErrorBoundary]')
    )

    if (investimentosLogs.length > 0) {
      console.log('\n=== LOGS DO COMPONENTE INVESTIMENTOS ===')
      investimentosLogs.forEach(log => {
        console.log(`[${log.type}]`, log.text)
      })
    }

    // Screenshot para análise visual
    await page.screenshot({ 
      path: 'e2e/screenshots/diagnostico-investimentos.png',
      fullPage: true 
    }).catch(() => {})

    console.log('\n=== FIM DO DIAGNÓSTICO ===\n')

    // Falhar o teste se houver erros (para forçar análise)
    if (pageErrors.length > 0 || hasErrorBoundary) {
      throw new Error(`DIAGNÓSTICO COMPLETO - Erros encontrados: ${pageErrors.length} page errors, ErrorBoundary ${hasErrorBoundary ? 'ATIVA' : 'inativa'}`)
    }
  })
})
